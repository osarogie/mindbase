import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { EditorDocumentKind } from '../context/editorTabId';

export function iconForDocumentKind(
  kind: EditorDocumentKind,
): ComponentProps<typeof Ionicons>['name'] {
  switch (kind) {
    case 'database':
      return 'grid-outline';
    case 'image':
      return 'image-outline';
    case 'pdf':
      return 'document-outline';
    case 'epub':
      return 'book-outline';
    case 'csv':
      return 'grid-outline';
    default:
      return 'document-text-outline';
  }
}
