export interface ContentCreatedEvent {
  id: string;
  slug: string;
  title: string;
}

export interface ContentUpdatedEvent {
  id: string;
  title?: string;
}

export interface ContentDeletedEvent {
  id: string;
  slug: string;
}

export interface ContentRestoredEvent {
  pageId: string;
  revisionId: string;
}

export interface MediaUploadedEvent {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface WorkflowTransitionEvent {
  pageId: string;
  from: string;
  to: string;
  actorId: string;
}

export interface PluginLifecycleEvent {
  pluginId: string;
  action: 'installed' | 'activated' | 'deactivated' | 'uninstalled';
}

export type AqEventPayload =
  | ContentCreatedEvent
  | ContentUpdatedEvent
  | ContentDeletedEvent
  | ContentRestoredEvent
  | MediaUploadedEvent
  | WorkflowTransitionEvent
  | PluginLifecycleEvent;

/** Maps dot-notation topic string → Oracle AQ queue name */
export const TOPIC_TO_QUEUE: Record<string, string> = {
  'content.created':     'AURORA_CMS.AQ_CONTENT_PUBLISHED',
  'content.updated':     'AURORA_CMS.AQ_CONTENT_UPDATED',
  'content.deleted':     'AURORA_CMS.AQ_CONTENT_DELETED',
  'content.restored':    'AURORA_CMS.AQ_CONTENT_UPDATED',
  'media.uploaded':      'AURORA_CMS.AQ_MEDIA_UPLOADED',
  'workflow.transition': 'AURORA_CMS.AQ_WORKFLOW_TRANSITION',
  'plugin.lifecycle':    'AURORA_CMS.AQ_PLUGIN_LIFECYCLE',
};
