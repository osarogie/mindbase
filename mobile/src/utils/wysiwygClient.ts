import { htmlToMarkdown as nativeHtmlToMarkdown, wysiwygNativeReady, wysiwygPage as nativeWysiwygPage } from 'mindbase';
import { editorHtmlToMarkdown, markdownToEditorHtml } from './markdownFallback';
import { buildWysiwygDocument } from './wysiwygShell';

function fallbackWysiwygPage(content: string): string {
  return buildWysiwygDocument(markdownToEditorHtml(content));
}

function fallbackHtmlToMarkdown(html: string): string {
  return editorHtmlToMarkdown(html);
}

export function isGoWysiwygAvailable(): boolean {
  return wysiwygNativeReady();
}

export async function wysiwygPage(path: string, content: string): Promise<string> {
  const nativeReady = wysiwygNativeReady();
  if (nativeReady) {
    return nativeWysiwygPage(path, content);
  }
  return fallbackWysiwygPage(content);
}

export async function htmlToMarkdown(html: string): Promise<string> {
  const nativeReady = wysiwygNativeReady();
  if (nativeReady) {
    return nativeHtmlToMarkdown(html);
  }
  return fallbackHtmlToMarkdown(html);
}
