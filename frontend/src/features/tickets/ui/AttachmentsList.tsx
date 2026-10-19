import { Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Attachment } from '@/shared/api/types';
import { EmptyState } from '@/shared/ui/states/EmptyState';

export function AttachmentsList({ attachments }: { attachments: Attachment[] }) {
  const { t } = useTranslation('tickets');
  if (attachments.length === 0) return <EmptyState title={t('noAttachments')} />;

  return (
    <ul className="space-y-2">
      {attachments.map((a, i) => (
        <li key={i}>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Paperclip className="h-4 w-4" />
            {a.name ?? a.url}
            {a.mime && <span className="text-xs text-muted-foreground">({a.mime})</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
