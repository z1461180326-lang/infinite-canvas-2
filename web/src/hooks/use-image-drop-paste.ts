import { useEffect, useRef, useState, type DragEventHandler, type MouseEventHandler } from "react";

function firstFile(data: DataTransfer) {
    const files = Array.from(data.files);
    const file = files.find((item) => item.type.startsWith("image/"));
    if (file) return file;
    if (files[0]) return files[0];
    for (const item of Array.from(data.items)) {
        if (item.kind !== "file") continue;
        const pasted = item.getAsFile();
        if (pasted) return pasted;
    }
    return undefined;
}

function isEditingText(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

/** 鼠标停在上传区时支持 Ctrl/Cmd+V；拖拽则整块区域都可接收。 */
export function useImageDropPaste({ enabled = true, onFile }: { enabled?: boolean; onFile: (file: File) => void | Promise<void> }) {
    const hoveredRef = useRef(false);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (!enabled || !hoveredRef.current || isEditingText(event.target)) return;
            const file = firstFile(event.clipboardData);
            if (!file) return;
            event.preventDefault();
            void onFile(file);
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [enabled, onFile]);

    const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
        event.preventDefault();
        if (enabled) setDragging(true);
    };
    const onDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setDragging(false);
    };
    const onDrop: DragEventHandler<HTMLDivElement> = (event) => {
        event.preventDefault();
        setDragging(false);
        if (!enabled) return;
        const file = firstFile(event.dataTransfer);
        if (file) void onFile(file);
    };
    const onMouseEnter: MouseEventHandler<HTMLDivElement> = () => {
        hoveredRef.current = true;
    };
    const onMouseLeave: MouseEventHandler<HTMLDivElement> = () => {
        hoveredRef.current = false;
    };

    return { dragging, dropProps: { onDragOver, onDragLeave, onDrop, onMouseEnter, onMouseLeave } };
}
