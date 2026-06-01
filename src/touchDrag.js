/**
 * 移动端 touch 拖拽排序 hook
 *
 * 给 HTML5 drag 不可用的环境（手机/平板）提供拖拽排序能力。
 * 直接复用现有的 onDragOver/onDragStart/onDragEnd 回调。
 *
 * 用法：
 *   const listRef = useRef(null);
 *   const touchProps = useTouchDrag(listRef, {
 *     onDragStart: (idx) => ...,
 *     onDragOver: (e, fromIdx, toIdx) => ..., // 和 HTML5 onDragOver 签名兼容
 *     onDragEnd: () => ...,
 *   });
 *   // listRef 放在容器上，每个可拖拽项必须有 data-sort-idx={index}
 */
import { useRef, useEffect } from "react";

export function useTouchDrag(containerRef, callbacks) {
  const stateRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getSortIdx = (node) => {
      while (node && !node.hasAttribute("data-sort-idx")) {
        node = node.parentElement;
      }
      return node ? parseInt(node.getAttribute("data-sort-idx"), 10) : -1;
    };

    // 根据手指 Y 坐标找最近的排序项
    const getDropIdx = (y) => {
      const items = el.querySelectorAll("[data-sort-idx]");
      let bestIdx = 0;
      let bestDist = Infinity;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(y - mid);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = parseInt(item.getAttribute("data-sort-idx"), 10);
        }
      });
      return bestIdx;
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const idx = getSortIdx(e.target);
      if (idx < 0) return;

      const touch = e.touches[0];
      stateRef.current = {
        touchId: touch.identifier,
        fromIdx: idx,
        lastIdx: idx,
      };

      // 高亮被拖拽项
      const target = el.querySelector(`[data-sort-idx="${idx}"]`);
      if (target) target.classList.add("touch-dragging");
      callbacks.onDragStart?.(idx);
    };

    const onTouchMove = (e) => {
      const st = stateRef.current;
      if (!st) return;
      e.preventDefault(); // 阻止页面滚动

      const touch = Array.from(e.touches).find(
        (t) => t.identifier === st.touchId
      );
      if (!touch) return;

      const dropIdx = getDropIdx(touch.clientY);
      if (dropIdx >= 0 && dropIdx !== st.lastIdx) {
        // 模拟 HTML5 dragOver 签名：第一个参数是 event，第二个是 dayStr，第三个是 idx
        // 但我们只传 idx 进去，因为 touchDrag 不关心 dayStr
        callbacks.onDragOver?.(e, null, dropIdx);
        st.lastIdx = dropIdx;
        // 移除旧高亮，加新高亮
        const items = el.querySelectorAll("[data-sort-idx]");
        items.forEach((item) => item.classList.remove("touch-dragging"));
        const target = el.querySelector(`[data-sort-idx="${dropIdx}"]`);
        if (target) target.classList.add("touch-dragging");
      }
    };

    const onTouchEnd = () => {
      const st = stateRef.current;
      if (!st) return;
      const items = el.querySelectorAll("[data-sort-idx]");
      items.forEach((item) => item.classList.remove("touch-dragging"));
      callbacks.onDragEnd?.();
      stateRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, callbacks]);
}
