import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCheck, IconX, IconChevronUp, IconChevronDown } from '@/components/ui/icons';
import iconOpenaiLight from '@/assets/icons/openai-light.svg';
import iconOpenaiDark from '@/assets/icons/openai-dark.svg';
import type { OpenAIProviderConfig } from '@/types';
import { maskApiKey } from '@/utils/format';
import { calculateStatusBarData, type KeyStats } from '@/utils/usage';
import { type UsageDetailsByAuthIndex, type UsageDetailsBySource } from '@/utils/usageIndex';
import styles from '@/pages/AiProvidersPage.module.scss';
import { ProviderList } from '../ProviderList';
import { ProviderStatusBar } from '../ProviderStatusBar';
import {
  collectOpenAIProviderUsageDetails,
  getOpenAIEntryKey,
  getOpenAIProviderKey,
  getOpenAIProviderStats,
  getStatsForIdentity,
} from '../utils';

type SortField = 'priority' | 'name' | 'successRate';
type SortDirection = 'asc' | 'desc';

interface OpenAISectionProps {
  configs: OpenAIProviderConfig[];
  keyStats: KeyStats;
  usageDetailsBySource: UsageDetailsBySource;
  usageDetailsByAuthIndex: UsageDetailsByAuthIndex;
  loading: boolean;
  disableControls: boolean;
  isSwitching: boolean;
  resolvedTheme: string;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

export function OpenAISection({
  configs,
  keyStats,
  usageDetailsBySource,
  usageDetailsByAuthIndex,
  loading,
  disableControls,
  isSwitching,
  resolvedTheme,
  onAdd,
  onEdit,
  onDelete,
}: OpenAISectionProps) {
  const { t } = useTranslation();
  const actionsDisabled = disableControls || loading || isSwitching;

  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedConfigs = useMemo(() => {
    const sorted = [...configs].sort((a, b) => {
      switch (sortField) {
        case 'priority': {
          const priorityA = a.priority ?? -Infinity;
          const priorityB = b.priority ?? -Infinity;
          return sortDirection === 'asc' ? priorityA - priorityB : priorityB - priorityA;
        }
        case 'name':
          return sortDirection === 'asc'
            ? (a.name || '').localeCompare(b.name || '')
            : (b.name || '').localeCompare(a.name || '');
        case 'successRate': {
          const statsA = getOpenAIProviderStats(a, keyStats);
          const statsB = getOpenAIProviderStats(b, keyStats);
          const totalA = statsA.success + statsA.failure;
          const totalB = statsB.success + statsB.failure;
          const rateA = totalA > 0 ? statsA.success / totalA : 0;
          const rateB = totalB > 0 ? statsB.success / totalB : 0;
          return sortDirection === 'asc' ? rateA - rateB : rateB - rateA;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [configs, sortField, sortDirection, keyStats]);

  const statusBarCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof calculateStatusBarData>>();

    sortedConfigs.forEach((provider, index) => {
      const providerKey = getOpenAIProviderKey(provider, index);
      cache.set(
        providerKey,
        calculateStatusBarData(
          collectOpenAIProviderUsageDetails(
            provider,
            usageDetailsBySource,
            usageDetailsByAuthIndex
          )
        )
      );
    });

    return cache;
  }, [sortedConfigs, usageDetailsByAuthIndex, usageDetailsBySource]);

  const renderSortButton = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <button
        className={`${styles.sortButton} ${isActive ? styles.sortButtonActive : ''}`}
        onClick={() => handleSortChange(field)}
        type="button"
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
        ) : (
          <IconChevronDown size={14} className={styles.sortIconInactive} />
        )}
      </button>
    );
  };

  return (
    <>
      <Card
        title={
          <span className={styles.cardTitle}>
            <img
              src={resolvedTheme === 'dark' ? iconOpenaiDark : iconOpenaiLight}
              alt=""
              className={styles.cardTitleIcon}
            />
            {t('ai_providers.openai_title')}
          </span>
        }
        extra={
          <Button size="sm" onClick={onAdd} disabled={actionsDisabled}>
            {t('ai_providers.openai_add_button')}
          </Button>
        }
      >
        {configs.length > 1 && (
          <div className={styles.sortBar}>
            <span className={styles.sortLabel}>{t('common.sort_by')}:</span>
            {renderSortButton('priority', t('common.priority'))}
            {renderSortButton('name', t('common.name'))}
            {renderSortButton('successRate', t('usage_stats.success_rate'))}
          </div>
        )}
        <ProviderList<OpenAIProviderConfig>
          items={sortedConfigs}
          loading={loading}
          keyField={(item, index) => getOpenAIProviderKey(item, index)}
          emptyTitle={t('ai_providers.openai_empty_title')}
          emptyDescription={t('ai_providers.openai_empty_desc')}
          onEdit={onEdit}
          onDelete={onDelete}
          actionsDisabled={actionsDisabled}
          renderContent={(item, index) => {
            const stats = getOpenAIProviderStats(item, keyStats);
            const headerEntries = Object.entries(item.headers || {});
            const apiKeyEntries = item.apiKeyEntries || [];
            const statusData =
              statusBarCache.get(getOpenAIProviderKey(item, index)) || calculateStatusBarData([]);

            return (
              <Fragment>
                <div className="item-title">{item.name}</div>
                {item.priority !== undefined && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.priority')}:</span>
                    <span className={styles.fieldValue}>{item.priority}</span>
                  </div>
                )}
                {item.prefix && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.prefix')}:</span>
                    <span className={styles.fieldValue}>{item.prefix}</span>
                  </div>
                )}
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>{t('common.base_url')}:</span>
                  <span className={styles.fieldValue}>{item.baseUrl}</span>
                </div>
                {headerEntries.length > 0 && (
                  <div className={styles.headerBadgeList}>
                    {headerEntries.map(([key, value]) => (
                      <span key={key} className={styles.headerBadge}>
                        <strong>{key}:</strong> {value}
                      </span>
                    ))}
                  </div>
                )}
                {apiKeyEntries.length > 0 && (
                  <div className={styles.apiKeyEntriesSection}>
                    <div className={styles.apiKeyEntriesLabel}>
                      {t('ai_providers.openai_keys_count')}: {apiKeyEntries.length}
                    </div>
                    <div className={styles.apiKeyEntryList}>
                      {apiKeyEntries.map((entry, entryIndex) => {
                        const entryStats = getStatsForIdentity(
                          { authIndex: entry.authIndex, apiKey: entry.apiKey },
                          keyStats
                        );
                        return (
                          <div
                            key={getOpenAIEntryKey(entry, entryIndex)}
                            className={styles.apiKeyEntryCard}
                          >
                            <span className={styles.apiKeyEntryIndex}>{entryIndex + 1}</span>
                            <span className={styles.apiKeyEntryKey}>{maskApiKey(entry.apiKey)}</span>
                            {entry.proxyUrl && (
                              <span className={styles.apiKeyEntryProxy}>{entry.proxyUrl}</span>
                            )}
                            <div className={styles.apiKeyEntryStats}>
                              <span
                                className={`${styles.apiKeyEntryStat} ${styles.apiKeyEntryStatSuccess}`}
                              >
                                <IconCheck size={12} /> {entryStats.success}
                              </span>
                              <span
                                className={`${styles.apiKeyEntryStat} ${styles.apiKeyEntryStatFailure}`}
                              >
                                <IconX size={12} /> {entryStats.failure}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className={styles.fieldRow} style={{ marginTop: '8px' }}>
                  <span className={styles.fieldLabel}>{t('ai_providers.openai_models_count')}:</span>
                  <span className={styles.fieldValue}>{item.models?.length || 0}</span>
                </div>
                {item.models?.length ? (
                  <div className={styles.modelTagList}>
                    {item.models.map((model) => (
                      <span key={model.name} className={styles.modelTag}>
                        <span className={styles.modelName}>{model.name}</span>
                        {model.alias && model.alias !== model.name && (
                          <span className={styles.modelAlias}>{model.alias}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.testModel && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Test Model:</span>
                    <span className={styles.fieldValue}>{item.testModel}</span>
                  </div>
                )}
                <div className={styles.cardStats}>
                  <span className={`${styles.statPill} ${styles.statSuccess}`}>
                    {t('stats.success')}: {stats.success}
                  </span>
                  <span className={`${styles.statPill} ${styles.statFailure}`}>
                    {t('stats.failure')}: {stats.failure}
                  </span>
                </div>
                <ProviderStatusBar statusData={statusData} />
              </Fragment>
            );
          }}
        />
      </Card>
    </>
  );
}
