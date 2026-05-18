// Path: app/event/[slug]/components/DetailsApprovalsModal.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SYSTEM = {
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

export default function DetailsApprovalsModal({
  approvalsOpen,
  setApprovalsOpen,
  pendingApprovals,
  profileNamesByEmail,
  resolvingRequestId,
  handleResolveApproval,
  t,
}: {
  approvalsOpen: boolean;
  setApprovalsOpen: (value: boolean) => void;
  pendingApprovals: any[];
  profileNamesByEmail: Record<string, string>;
  resolvingRequestId: string | null;
  handleResolveApproval: (requestId: string, decision: 'approved' | 'denied') => void;
  t: any;
}) {
  return (
    <Modal
      visible={approvalsOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setApprovalsOpen(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('event_approvals')}</Text>
            <TouchableOpacity onPress={() => setApprovalsOpen(false)}>
              <Ionicons name="close" size={22} color={SYSTEM.text} />
            </TouchableOpacity>
          </View>

          {pendingApprovals.length === 0 ? (
            <View style={styles.emptyApprovalsState}>
              <Text style={styles.emptyApprovalsTitle}>{t('event_no_pending_approvals')}</Text>
              <Text style={styles.emptyApprovalsText}>{t('event_pending_approvals_body')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {pendingApprovals.map((req: any) => {
                const emailLc = normalizeEmail(req.requester_email || req.email);
                const label =
                  profileNamesByEmail[emailLc] ||
                  req.requester_name ||
                  req.requester_email ||
                  req.email ||
                  t('event_guest_fallback');

                const requestId = String(req.id);
                const busy = resolvingRequestId === requestId;

                return (
                  <View key={requestId} style={styles.approvalRow}>
                    <View style={styles.approvalCopy}>
                      <Text style={styles.approvalName}>{label}</Text>
                      {!!req.requester_email && (
                        <Text style={styles.approvalMeta}>{req.requester_email}</Text>
                      )}
                      {!!req.requested_status && (
                        <Text style={styles.approvalMeta}>
                          {t('event_wants_to_respond', { status: String(req.requested_status) })}
                        </Text>
                      )}
                    </View>

                    <View style={styles.approvalActions}>
                      <TouchableOpacity
                        disabled={busy}
                        style={[
                          styles.approvalBtn,
                          styles.declineBtn,
                          busy && styles.approvalBtnDisabled,
                        ]}
                        onPress={() => handleResolveApproval(requestId, 'denied')}
                      >
                        <Text style={styles.declineBtnText}>
                          {busy ? t('event_working') : t('event_decline')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        disabled={busy}
                        style={[
                          styles.approvalBtn,
                          styles.approveBtn,
                          busy && styles.approvalBtnDisabled,
                        ]}
                        onPress={() => handleResolveApproval(requestId, 'approved')}
                      >
                        <Text style={styles.approveBtnText}>
                          {busy ? t('event_working') : t('event_approve')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '78%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: SYSTEM.text,
  },

  emptyApprovalsState: {
    paddingVertical: 24,
  },

  emptyApprovalsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
  },

  emptyApprovalsText: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
  },

  approvalRow: {
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  approvalCopy: {
    marginBottom: 12,
  },

  approvalName: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
  },

  approvalMeta: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
  },

  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  approvalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  approvalBtnDisabled: {
    opacity: 0.6,
  },

  approveBtn: {
    backgroundColor: SYSTEM.primary,
  },

  approveBtnText: {
    color: '#fff',
    fontWeight: '800',
  },

  declineBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  declineBtnText: {
    color: SYSTEM.text,
    fontWeight: '800',
  },
});