import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type VisibilityMode = 1 | 2 | 3;
export type VisibilityText = 'host_only' | 'guests_can_see';
export type ForwardingMode = 'free' | 'host_approval' | null;
export type ReminderDays = 1 | 2 | 3 | 5 | 7;
export type WhenMode = 'specific' | 'series' | 'options' | 'unsure';
export type InviteOption = 'direct' | 'circle' | 'friends_of_friends' | null;

export type FormalDraftState = {
  title: string;
  whenMode: WhenMode;
  specificDate: Date;
  seriesDates: Date[];
  pollOptions: Date[];
  endDate: Date | null;
  description: string;
  location: string;
  external_url: string;
  host_name: string;
  host_email: string;
  visibility: VisibilityMode;
  invite_list_visibility: VisibilityText;
  guest_list_visibility: VisibilityText;
  send_rsvp_reminders: boolean;
  remind_after_days: ReminderDays;
  rsvp_deadline: string | null;
  send_final_reminder_at_deadline: boolean;
  forwarding_mode: ForwardingMode;
  invite_option: InviteOption;
  visible_in_feed: boolean;
  requires_approval: boolean;
};

export type FormalDraftPrefill = {
  prefill_title?: string;
  prefill_desc?: string;
  prefill_date?: string;
};

type FormalDraftContextValue = {
  form: FormalDraftState;
  setForm: React.Dispatch<React.SetStateAction<FormalDraftState>>;
  updateForm: <K extends keyof FormalDraftState>(
    key: K,
    value: FormalDraftState[K]
  ) => void;
  resetForm: (prefill?: FormalDraftPrefill) => void;
  initializeFromPrefill: (prefill?: FormalDraftPrefill) => void;
};

function buildInitialFormalDraft(
  prefill?: FormalDraftPrefill
): FormalDraftState {
  const initialDate = prefill?.prefill_date
    ? new Date(prefill.prefill_date)
    : new Date();

  return {
    title: prefill?.prefill_title || '',
    whenMode: 'specific',
    specificDate: initialDate,
    seriesDates: [],
    pollOptions: [],
    endDate: null,
    description: prefill?.prefill_desc || '',
    location: '',
    external_url: '',
    host_name: '',
    host_email: '',

    visibility: 2,

    visible_in_feed: true,
    requires_approval: false,

    invite_list_visibility: 'host_only',
    guest_list_visibility: 'guests_can_see',
    send_rsvp_reminders: false,
    remind_after_days: 3,
    rsvp_deadline: null,
    send_final_reminder_at_deadline: false,
    forwarding_mode: null,
    invite_option: null,
  };
}

const FormalDraftContext = createContext<FormalDraftContextValue | null>(null);

export function FormalDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [form, setForm] = useState<FormalDraftState>(() => buildInitialFormalDraft());
  const hasInitializedRef = useRef(false);

  const updateForm = useCallback(
    <K extends keyof FormalDraftState>(key: K, value: FormalDraftState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetForm = useCallback((prefill?: FormalDraftPrefill) => {
    hasInitializedRef.current = !!prefill;
    setForm(buildInitialFormalDraft(prefill));
  }, []);

  const initializeFromPrefill = useCallback((prefill?: FormalDraftPrefill) => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    setForm((prev) => {
      const next = buildInitialFormalDraft(prefill);
      return prev.title ||
        prev.description ||
        prev.location ||
        prev.external_url ||
        prev.host_name ||
        prev.host_email ||
        prev.seriesDates.length > 0 ||
        prev.pollOptions.length > 0 ||
        prev.endDate !== null
        ? prev
        : next;
    });
  }, []);

  const value = useMemo<FormalDraftContextValue>(
    () => ({
      form,
      setForm,
      updateForm,
      resetForm,
      initializeFromPrefill,
    }),
    [form, resetForm, initializeFromPrefill, updateForm]
  );

  return (
    <FormalDraftContext.Provider value={value}>
      {children}
    </FormalDraftContext.Provider>
  );
}

export function useFormalDraft() {
  const context = useContext(FormalDraftContext);

  if (!context) {
    throw new Error('useFormalDraft must be used within a FormalDraftProvider');
  }

  return context;
}
