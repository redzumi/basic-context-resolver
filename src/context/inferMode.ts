import type { ContextMode, FinalContext } from './types';
import { isBrowserApp, isChatApp, isBrowserChatDomain } from './helpers';

export function inferMode(params: {
  appName?: string;
  domain?: string;
  title?: string;
}): ContextMode {
  const { appName = '', domain = '', title = '' } = params;

  const a = appName.toLowerCase();
  const d = domain.toLowerCase();
  const t = title.toLowerCase();

  if (isChatApp(appName)) {
    return 'desktop_chat';
  }

  if (d && isBrowserChatDomain(d)) {
    return 'browser_chat';
  }

  if (
    d.includes('mail.google.com') ||
    d.includes('outlook.live.com') ||
    d.includes('outlook.office.com') ||
    t.includes(' - compose') ||
    t.includes('new message')
  ) {
    return 'email';
  }

  if (d.includes('notion.so') || d.includes('notion.site') || t.includes('notion')) {
    return 'document';
  }

  if (d.includes('github.com') || d.includes('linear.app') || d.includes('gitlab.com')) {
    return 'issue_comment';
  }

  if (a.includes('code') || a.includes('cursor') || a.includes('windsurf') || a.includes('sublime') || a.includes('vscode')) {
    return 'code';
  }

  if (isBrowserApp(appName)) {
    return 'browser_generic';
  }

  return 'generic_text';
}

export function buildFinalContext(params: {
  appName?: string;
  title?: string;
  url?: string;
  domain?: string;
  selectedText?: string;
  inputValuePreview?: string;
}): FinalContext {
  const mode = inferMode({
    appName: params.appName,
    domain: params.domain,
    title: params.title,
  });

  return {
    mode,
    appName: params.appName,
    activeTitle: params.title,
    url: params.url,
    domain: params.domain,
    selectedText: params.selectedText,
    inputValuePreview: params.inputValuePreview,
  };
}
