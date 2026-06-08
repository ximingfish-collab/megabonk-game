/**
 * 客户端"视图系统"：第三人称环绕镜头 + FPS 风格 pointer lock。
 *
 * 输入：
 *   - PC 桌面：点击画布（非 UI 区域）进入 pointer lock；鼠标移动 → yaw + pitch
 *   - PC 拖拽：未 lock 时按住鼠标拖拽也能转（向后兼容）
 *   - 手机：右半屏拖拽（左半屏给虚拟摇杆，避免冲突）
 *
 * UI 隔离：
 *   - 只有鼠标不在任何可交互 UI / 面板上时，才允许视角控制。
 *   - 使用 elementFromPoint 检测顶层命中元素；HUD 按钮、面板、菜单等
 *     pointer-events:auto 区域会阻断镜头输入并释放 pointer lock。
 *
 * 输出：
 *   - getYaw() —— 给 input system 旋转 WASD 用（只用 yaw，不用 pitch）
 *   - update(camera, playerPos, dt) —— 每帧相机位置 + 平滑 lookAt
 */

import * as THREE from 'three';

interface PlayerPos {
  x: number;
  y: number;
  z: number;
}

const PITCH_LIMIT = (Math.PI / 180) * 75;
const MOUSE_SENS_LOCK = 0.002;
const MOUSE_SENS_DRAG = 0.005;
const TOUCH_SENS = 0.005;
const CAM_DISTANCE = 7;
const CAM_HEIGHT_BASE = 5;
const LOOK_AT_HEIGHT = 1.5;
const LOOK_AT_LEAD = 2;
const FOLLOW_RATE = 14;

export class CameraOrbit {
  private yaw = 0;
  private pitch = 0;
  private ghostX = 0;
  private ghostY = 0;
  private ghostZ = 0;
  private ghostInitialized = false;
  private dragPointerId = -1;
  private dragLastX = 0;
  private dragLastY = 0;
  private locked = false;
  private enabled = true;
  private mouseInsideCanvas = false;
  /** 当前指针是否位于可交互 UI 上（HUD 按钮 / 面板 / 菜单等）。 */
  private pointerOverUi = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cleanups: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const onLockChange = () => {
      this.locked = document.pointerLockElement === canvas;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    this.cleanups.push(() => document.removeEventListener('pointerlockchange', onLockChange));

    // 全局指针跟踪：进入 UI 区域时立刻阻断镜头输入。
    const onGlobalPointerMove = (e: PointerEvent) => {
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.updatePointerUiState(e.clientX, e.clientY);
    };
    document.addEventListener('pointermove', onGlobalPointerMove);
    this.cleanups.push(() => document.removeEventListener('pointermove', onGlobalPointerMove));

    const onEnter = (e: PointerEvent) => {
      this.mouseInsideCanvas = true;
      this.updatePointerUiState(e.clientX, e.clientY);
      if (this.canUseCameraInput(e.clientX, e.clientY) && !this.locked && !this.isTouchDevice()) {
        this.requestLock();
      }
    };
    const onLeave = () => {
      this.mouseInsideCanvas = false;
    };
    canvas.addEventListener('pointerenter', onEnter);
    canvas.addEventListener('pointerleave', onLeave);
    this.cleanups.push(
      () => canvas.removeEventListener('pointerenter', onEnter),
      () => canvas.removeEventListener('pointerleave', onLeave),
    );

    const onClick = (e: MouseEvent) => {
      if (!this.canUseCameraInput(e.clientX, e.clientY)) return;
      if (this.locked) return;
      if (this.isTouchDevice()) return;
      this.requestLock();
    };
    canvas.addEventListener('click', onClick);
    this.cleanups.push(() => canvas.removeEventListener('click', onClick));

    const onMouseMove = (e: MouseEvent) => {
      if (!this.canUseCameraInput()) return;
      if (!this.locked) return;
      this.yaw += e.movementX * MOUSE_SENS_LOCK;
      this.pitch -= e.movementY * MOUSE_SENS_LOCK;
      if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
      else if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
    };
    document.addEventListener('mousemove', onMouseMove);
    this.cleanups.push(() => document.removeEventListener('mousemove', onMouseMove));

    const onPointerDown = (e: PointerEvent) => {
      if (!this.canUseCameraInput(e.clientX, e.clientY)) return;
      if (this.locked) return;
      if (this.dragPointerId !== -1) return;
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.5) return;
      this.dragPointerId = e.pointerId;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== this.dragPointerId) return;
      if (!this.canUseCameraInput(e.clientX, e.clientY)) {
        this.dragPointerId = -1;
        return;
      }
      const sens = e.pointerType === 'touch' ? TOUCH_SENS : MOUSE_SENS_DRAG;
      this.yaw += (e.clientX - this.dragLastX) * sens;
      this.pitch -= (e.clientY - this.dragLastY) * sens;
      if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
      else if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    };
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId === this.dragPointerId) this.dragPointerId = -1;
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', endDrag);
    this.cleanups.push(
      () => canvas.removeEventListener('pointerdown', onPointerDown),
      () => canvas.removeEventListener('pointermove', onPointerMove),
      () => canvas.removeEventListener('pointerup', endDrag),
      () => canvas.removeEventListener('pointercancel', endDrag),
      () => canvas.removeEventListener('pointerleave', endDrag),
    );
  }

  getYaw(): number {
    return this.yaw;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      if (this.locked) document.exitPointerLock?.();
      this.dragPointerId = -1;
    } else if (
      this.mouseInsideCanvas
      && !this.isTouchDevice()
      && this.canUseCameraInput(this.lastPointerX, this.lastPointerY)
    ) {
      this.requestLock();
    }
  }

  update(camera: THREE.PerspectiveCamera, p: PlayerPos, dt: number): void {
    if (!this.ghostInitialized) {
      this.ghostX = p.x;
      this.ghostY = p.y;
      this.ghostZ = p.z;
      this.ghostInitialized = true;
    }

    const a = 1 - Math.exp(-FOLLOW_RATE * Math.max(dt, 1e-4));
    this.ghostX += (p.x - this.ghostX) * a;
    this.ghostY += (p.y - this.ghostY) * a;
    this.ghostZ += (p.z - this.ghostZ) * a;

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);

    camera.position.set(
      this.ghostX - sy * cp * CAM_DISTANCE,
      this.ghostY + CAM_HEIGHT_BASE + sp * CAM_DISTANCE,
      this.ghostZ - cy * cp * CAM_DISTANCE,
    );

    camera.lookAt(
      this.ghostX + sy * LOOK_AT_LEAD,
      this.ghostY + LOOK_AT_HEIGHT,
      this.ghostZ + cy * LOOK_AT_LEAD,
    );
  }

  snap(p: PlayerPos): void {
    this.ghostX = p.x;
    this.ghostY = p.y;
    this.ghostZ = p.z;
    this.ghostInitialized = true;
  }

  dispose(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    if (this.locked) document.exitPointerLock?.();
  }

  /** 指针是否落在可交互 UI 上（非画布游戏区域）。 */
  private isPointerOverBlockingUi(clientX: number, clientY: number): boolean {
    let el = document.elementFromPoint(clientX, clientY);
    while (el) {
      if (el === this.canvas) return false;
      const html = el as HTMLElement;
      if (html.dataset.cameraBlock === 'true') return true;
      const style = window.getComputedStyle(html);
      if (
        style.pointerEvents !== 'none'
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && html !== document.body
        && html !== document.documentElement
      ) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  private updatePointerUiState(clientX: number, clientY: number): void {
    const overUi = this.isPointerOverBlockingUi(clientX, clientY);
    if (overUi === this.pointerOverUi) return;
    this.pointerOverUi = overUi;
    if (overUi) {
      if (this.locked) document.exitPointerLock?.();
      this.dragPointerId = -1;
    }
  }

  private canUseCameraInput(clientX?: number, clientY?: number): boolean {
    if (!this.enabled) return false;
    if (this.pointerOverUi) return false;
    if (clientX !== undefined && clientY !== undefined) {
      if (this.isPointerOverBlockingUi(clientX, clientY)) return false;
    }
    return true;
  }

  private requestLock(): void {
    this.canvas.requestPointerLock?.();
  }

  private isTouchDevice(): boolean {
    return (navigator.maxTouchPoints ?? 0) > 0;
  }
}
