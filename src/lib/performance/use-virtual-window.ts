"use client";

import { useCallback, useMemo, useState } from "react";

type Options = {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
};

export function useVirtualWindow({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 4,
}: Options) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const range = useMemo(() => {
    if (itemCount === 0) return { start: 0, end: 0, offsetY: 0, totalHeight: 0 };
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visible = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const end = Math.min(itemCount, start + visible);
    return {
      start,
      end,
      offsetY: start * itemHeight,
      totalHeight: itemCount * itemHeight,
    };
  }, [containerHeight, itemCount, itemHeight, overscan, scrollTop]);

  return { ...range, onScroll, scrollTop };
}
