import { useCallback, useEffect, useState } from "react";
import { useAppChatHistoryPage } from "@/shared/query";
import { type AppId, type ChatHistory } from "@/shared/schemas";

const pageSize = 10;

export type ChatHistoryFeed = {
  readonly records: ReadonlyArray<ChatHistory>;
  readonly loaded: boolean;
  readonly fetching: boolean;
  readonly hasMore: boolean;
  readonly loadMore: () => void;
};

export function useChatHistoryFeed(appId: AppId): ChatHistoryFeed {
  const [cursor, setCursor] = useState<string | undefined>();
  const [records, setRecords] = useState<ReadonlyArray<ChatHistory>>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const query = useAppChatHistoryPage(appId, buildParams(cursor));

  useEffect(() => {
    if (!query.data) return;
    const pageRecords = query.data.records;
    setRecords((current) =>
      cursor === undefined ? pageRecords : appendUnique(current, pageRecords),
    );
    setHasMore(pageRecords.length === pageSize);
    setLoaded(true);
  }, [cursor, query.data]);

  const loadMore = useCallback(() => {
    if (!hasMore || query.isFetching) return;
    const oldest = records.at(-1)?.createTime;
    if (oldest !== undefined && oldest !== cursor) {
      setCursor(oldest);
    }
  }, [cursor, hasMore, query.isFetching, records]);

  return {
    records,
    loaded,
    fetching: query.isFetching,
    hasMore,
    loadMore,
  };
}

function buildParams(cursor: string | undefined): {
  readonly pageSize: number;
  readonly lastCreateTime?: string;
} {
  return cursor === undefined
    ? { pageSize }
    : { pageSize, lastCreateTime: cursor };
}

function appendUnique(
  current: ReadonlyArray<ChatHistory>,
  next: ReadonlyArray<ChatHistory>,
): ReadonlyArray<ChatHistory> {
  const known = new Set(current.map((record) => record.id));
  return [...current, ...next.filter((record) => !known.has(record.id))];
}
