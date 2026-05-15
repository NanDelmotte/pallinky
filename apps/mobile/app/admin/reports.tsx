import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';

type ReportRow = {
  id: string;
  reporter_email: string | null;
  target_type: string | null;
  target_id: string | null;
  target_user_email: string | null;
  reason: string | null;
  details: string | null;
  status: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  actioned_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { session } = useSession();

  const email = session?.user?.email?.toLowerCase().trim() || '';
  const isAdmin = email === 'nanbowles@gmail.com';

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const loadReports = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('reports')
        .select(
          'id, reporter_email, target_type, target_id, target_user_email, reason, details, status, created_at, reviewed_at, actioned_at'
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setReports((data || []) as ReportRow[]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function markReviewed(reportId: string) {
    const { error } = await supabase.rpc('mark_report_reviewed', {
      p_report_id: reportId,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await loadReports();
  }

  async function markActioned(reportId: string) {
    const { error } = await supabase.rpc('mark_report_actioned', {
      p_report_id: reportId,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await loadReports();
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <StyledText style={styles.deniedTitle}>Admin access only</StyledText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
        <Ionicons name="arrow-back" size={28} color="#43691b" />
      </TouchableOpacity>

      <StyledText style={styles.headerTitle}>Reports</StyledText>
      <StyledText style={styles.subtitle}>
        Review objectionable content and abusive-user reports within 24 hours.
      </StyledText>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#43691b" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyCard}>
          <StyledText style={styles.emptyText}>No reports yet.</StyledText>
        </View>
      ) : (
        reports.map((report) => (
          <View key={report.id} style={styles.card}>
            <View style={styles.cardTop}>
              <StyledText style={styles.reason}>
                {report.reason || 'Report'}
              </StyledText>

              <View
                style={[
                  styles.statusBadge,
                  report.status === 'actioned'
                    ? styles.statusActioned
                    : report.status === 'reviewed'
                    ? styles.statusReviewed
                    : styles.statusOpen,
                ]}
              >
                <StyledText style={styles.statusText}>
                  {report.status || 'open'}
                </StyledText>
              </View>
            </View>

            <StyledText style={styles.meta}>
              Type: {report.target_type || 'unknown'}
            </StyledText>

            {report.target_user_email ? (
              <StyledText style={styles.meta}>
                Target: {report.target_user_email}
              </StyledText>
            ) : null}

            {report.reporter_email ? (
              <StyledText style={styles.meta}>
                Reporter: {report.reporter_email}
              </StyledText>
            ) : null}

            {report.details ? (
              <StyledText style={styles.details}>{report.details}</StyledText>
            ) : null}

            {report.created_at ? (
              <StyledText style={styles.date}>
                Created: {formatDate(report.created_at)}
              </StyledText>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.reviewBtn}
                onPress={() => void markReviewed(report.id)}
              >
                <StyledText style={styles.reviewBtnText}>Mark reviewed</StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => void markActioned(report.id)}
              >
                <StyledText style={styles.actionBtnText}>Mark actioned</StyledText>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F7F9',
    padding: 24,
    paddingTop: 56,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2a1b',
  },
  backArrow: {
    width: 40,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1f2a1b',
  },
  subtitle: {
    marginTop: 6,
    color: '#66715f',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  loadingWrap: {
    marginTop: 30,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ede2',
  },
  emptyText: {
    color: '#66715f',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ede2',
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  reason: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#1f2a1b',
    textTransform: 'capitalize',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusOpen: {
    backgroundColor: '#fdecec',
  },
  statusReviewed: {
    backgroundColor: '#efe9f7',
  },
  statusActioned: {
    backgroundColor: '#eef6e8',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1f2a1b',
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 13,
    color: '#66715f',
    marginTop: 4,
  },
  details: {
    marginTop: 10,
    fontSize: 14,
    color: '#1f2a1b',
    lineHeight: 20,
  },
  date: {
    marginTop: 10,
    fontSize: 12,
    color: '#66715f',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  reviewBtn: {
    flex: 1,
    backgroundColor: '#efe9f7',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: '#6A4C93',
    fontWeight: '900',
    fontSize: 13,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#43691b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
});