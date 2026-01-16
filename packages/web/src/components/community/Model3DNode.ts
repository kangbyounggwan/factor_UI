/**
 * TipTap 커스텀 노드: 3D 모델 임베드
 * 에디터에서 3D 모델을 임베드할 수 있게 해주는 확장
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Model3DNodeComponent } from './Model3DNodeComponent';

export interface Model3DOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    model3d: {
      /**
       * 3D 모델을 삽입합니다
       */
      setModel3D: (options: { url: string; filename: string; filetype: string; gcodeId?: string; isLoading?: boolean; thumbnail?: string; downloadable?: boolean }) => ReturnType;
      /**
       * 특정 URL의 3D 모델 로딩 상태를 업데이트합니다
       */
      updateModel3DLoading: (tempUrl: string, newUrl: string, thumbnail?: string) => ReturnType;
      /**
       * 특정 URL의 3D 모델 다운로드 가능 여부를 업데이트합니다
       */
      updateModel3DDownloadable: (url: string, downloadable: boolean) => ReturnType;
      /**
       * 특정 URL의 3D 모델을 삭제합니다
       */
      removeModel3DByUrl: (url: string) => ReturnType;
    };
  }
}

export const Model3DNode = Node.create<Model3DOptions>({
  name: 'model3d',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: element => element.getAttribute('data-url'),
        renderHTML: attributes => {
          if (!attributes.url) {
            return {};
          }
          return { 'data-url': attributes.url };
        },
      },
      filename: {
        default: null,
        parseHTML: element => element.getAttribute('data-filename'),
        renderHTML: attributes => {
          if (!attributes.filename) {
            return {};
          }
          return { 'data-filename': attributes.filename };
        },
      },
      filetype: {
        default: null,
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => {
          if (!attributes.filetype) {
            return {};
          }
          return { 'data-type': attributes.filetype };
        },
      },
      gcodeId: {
        default: null,
        parseHTML: element => element.getAttribute('data-gcode-id'),
        renderHTML: attributes => {
          if (!attributes.gcodeId) {
            return {};
          }
          return { 'data-gcode-id': attributes.gcodeId };
        },
      },
      isLoading: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
      thumbnail: {
        default: null,
        parseHTML: element => element.getAttribute('data-thumbnail'),
        renderHTML: attributes => {
          if (!attributes.thumbnail) {
            return {};
          }
          return { 'data-thumbnail': attributes.thumbnail };
        },
      },
      downloadable: {
        default: true,
        parseHTML: element => element.getAttribute('data-downloadable') !== 'false',
        renderHTML: attributes => {
          return { 'data-downloadable': attributes.downloadable ? 'true' : 'false' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[class="model-3d-embed"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'model-3d-embed' }),
      [
        'div',
        { class: 'p-4 border rounded-lg bg-muted/30 my-2' },
        [
          'div',
          { class: 'flex items-center gap-2 text-sm' },
          ['span', {}, '📦'],
          ['span', { class: 'font-medium' }, HTMLAttributes['data-filename'] || '3D Model'],
          ['span', { class: 'text-muted-foreground' }, '(3D 모델)'],
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(Model3DNodeComponent);
  },

  addCommands() {
    return {
      setModel3D:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
      updateModel3DLoading:
        (tempUrl: string, newUrl: string, thumbnail?: string) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === tempUrl) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  url: newUrl,
                  isLoading: false,
                  thumbnail: thumbnail || node.attrs.thumbnail,
                });
              }
              found = true;
              return false;
            }
            return true;
          });
          if (found && dispatch) {
            dispatch(tr);
          }
          return found;
        },
      updateModel3DDownloadable:
        (url: string, downloadable: boolean) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === url) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  downloadable,
                });
              }
              found = true;
              return false;
            }
            return true;
          });
          if (found && dispatch) {
            dispatch(tr);
          }
          return found;
        },
      removeModel3DByUrl:
        (url: string) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          // 역순으로 탐색하여 위치 인덱스가 변하지 않도록 함
          const nodesToRemove: { pos: number; size: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === url) {
              nodesToRemove.push({ pos, size: node.nodeSize });
              found = true;
            }
            return true;
          });
          if (found && dispatch) {
            // 역순으로 삭제하여 위치가 변하지 않도록
            nodesToRemove.reverse().forEach(({ pos, size }) => {
              tr.delete(pos, pos + size);
            });
            dispatch(tr);
          }
          return found;
        },
    };
  },
});

export default Model3DNode;
