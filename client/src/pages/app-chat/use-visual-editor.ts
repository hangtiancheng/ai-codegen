import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  visualEditorIncomingMessageSchema,
  type VisualEditorElementInfo,
} from "@/shared/schemas";

export type VisualEditorState = {
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly editMode: boolean;
  readonly selectedElement: VisualEditorElementInfo | undefined;
  readonly toggleEditMode: () => void;
  readonly exitEditMode: () => void;
  readonly clearSelection: () => void;
  readonly handleIframeLoad: () => void;
};

export function useVisualEditor(): VisualEditorState {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] =
    useState<VisualEditorElementInfo>();

  const postToIframe = useCallback((message: object): void => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(undefined);
    postToIframe({ type: "CLEAR_SELECTION" });
  }, [postToIframe]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedElement(undefined);
    postToIframe({ type: "TOGGLE_EDIT_MODE", editMode: false });
    postToIframe({ type: "CLEAR_ALL_EFFECTS" });
  }, [postToIframe]);

  const toggleEditMode = useCallback(() => {
    setEditMode((current) => {
      const next = !current;
      postToIframe({ type: "TOGGLE_EDIT_MODE", editMode: next });
      if (!next) {
        setSelectedElement(undefined);
        postToIframe({ type: "CLEAR_ALL_EFFECTS" });
      }
      return next;
    });
  }, [postToIframe]);

  const handleIframeLoad = useCallback(() => {
    postToIframe({ type: "TOGGLE_EDIT_MODE", editMode });
  }, [editMode, postToIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      const result = visualEditorIncomingMessageSchema.safeParse(event.data);
      if (!result.success) return;
      if (result.data.type === "ELEMENT_SELECTED") {
        setSelectedElement(result.data.elementInfo);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
    iframeRef,
    editMode,
    selectedElement,
    toggleEditMode,
    exitEditMode,
    clearSelection,
    handleIframeLoad,
  };
}
