import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

export interface Props {
  feedbackUrl?: string;
}

export function FeedbackLink({ feedbackUrl }: Props) {
  const styles = useStyles2(getStyles);

  if (!config.feedbackLinksEnabled) {
    return null;
  }

  return (
    <Stack gap={1}>
      <a
        href={feedbackUrl}
        className={styles.link}
        title="This query builder is new, please let us know how we can improve it"
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" /> Give feedback
      </a>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    link: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      ':hover': {
        color: theme.colors.text.link,
      },
    }),
  };
}
