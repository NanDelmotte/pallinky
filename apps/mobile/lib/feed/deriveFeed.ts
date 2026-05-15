// apps/mobile/lib/feed/deriveFeed.ts

export type FeedState = 'cold_start' | 'early_network' | 'mature_network';

type RelationshipEntry = {
  key: string;
  personId?: string;
  personEmail?: string;
  sharedEvents: number;
  hostedByYouCount: number;
  hostedByThemCount: number;
  sharedEventsActivity: Array<{
    id: string;
    title: string;
    subtitle: string;
    dateLabel: string;
    detail: string;
    type: 'shared_event';
  }>;
  lastSeenAt: string | null;
  lastSeenAtMs: number | null;
  lastSeenEventTitle?: string;
  source: 'manual' | 'shared_event' | 'manual_and_shared_event';
};

export type FeedSignal =
  | 'upcoming_plan'
  | 'event_starting_soon'
  | 'incoming_invite'
  | 'friend_created_event'
  | 'friend_attending_event'
  | 'inner_circle_person'
  | 'active_connection'
  | 'reconnect_person'
  | 'suggested_connection'
  | 'unread_event_chat'
  | 'seeing_soon'
  | 'quick_start_prompt'
  | 'import_contacts_prompt';

export type FeedIdentity = {
  key: string | null;
  personId?: string;
  personEmail?: string;
};

export type FeedPersonRef = {
  personId?: string;
  personEmail?: string;
};

export type FeedItem = {
  id: string;
  type: FeedSignal;
  priority: number;
  eventId?: string;
  personId?: string;
  personEmail?: string;
  payload: any;
};

export type FeedDerivationResult = {
  feedState: FeedState;
  meta: {
    contactCount: number;
    friendCount: number;
    upcomingEventCount: number;
    networkActivityCount: number;
  };
  items: FeedItem[];
};

function toEmailLc(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function toPersonId(value: unknown) {
  const id = String(value || '').trim();
  return id || '';
}

function eventStartMs(event: any) {
  if (!event?.starts_at) return null;
  const ms = new Date(event.starts_at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function resolveIdentity(input: any): FeedIdentity {
  if (!input) return { key: null };

  if (typeof input === 'string') {
    const email = toEmailLc(input);
    return email ? { key: `email:${email}`, personEmail: email } : { key: null };
  }

  const personId = toPersonId(
    input.person_id ??
      input.personId ??
      input.related_person_id ??
      input.matched_user_id ??
      input.member_user_id ??
      input.people?.id ??
      null
  );

  const personEmail = toEmailLc(
    input.email_lc ??
      input.email ??
      input.member_email_lc ??
      input.primary_email_lc ??
      input.invitee_email_lc ??
      input.user_email ??
      input.host_email ??
      input.recipient_email ??
      input.people?.email_lc ??
      null
  );

  if (personId) {
    return {
      key: `person:${personId}`,
      personId,
      personEmail: personEmail || undefined,
    };
  }

  if (personEmail) {
    return {
      key: `email:${personEmail}`,
      personEmail,
    };
  }

  return { key: null };
}

function sameIdentity(a: FeedIdentity | null | undefined, b: FeedIdentity | null | undefined) {
  if (!a || !b) return false;

  const aPersonId = toPersonId(a.personId);
  const bPersonId = toPersonId(b.personId);
  if (aPersonId && bPersonId && aPersonId === bPersonId) return true;

  const aEmail = toEmailLc(a.personEmail);
  const bEmail = toEmailLc(b.personEmail);
  if (aEmail && bEmail && aEmail === bEmail) return true;

  return !!a.key && !!b.key && a.key === b.key;
}

function stablePersonRef(identity: FeedIdentity) {
  if (identity.personId) return `person:${identity.personId}`;
  if (identity.personEmail) return identity.personEmail;
  return 'unknown';
}

function isPositiveRsvpStatus(status: string | null | undefined) {
  const normalized = toEmailLc(status);
  return ['yes', 'going', 'interested', 'maybe'].includes(normalized);
}

function isPositiveParticipationStatus(status: string | null | undefined) {
  const normalized = toEmailLc(status);
  return isPositiveRsvpStatus(normalized) || normalized === 'voted';
}

function makePersonFeedFields(identity: FeedIdentity): FeedPersonRef {
  return {
    personId: identity.personId,
    personEmail: identity.personEmail,
  };
}

function resolveDisplayName(input: any) {
  const value = String(
    input?.member_name ??
      input?.name ??
      input?.display_name ??
      input?.host_name ??
      input?.invitee_name ??
      ''
  ).trim();

  return value || undefined;
}

export function deriveFeedSignals(input: {
  data: any;
  deviceContactCount: number;
}): FeedDerivationResult {
  const data = input.data || {};
  const accessByEventId = data.accessByEventId || {};

  const rawEvents = Array.isArray(data.events) ? data.events : [];
  const rsvps = Array.isArray(data.rsvps) ? data.rsvps : [];
  const vibeResponses = Array.isArray(data.vibeResponses) ? data.vibeResponses : [];
  const secondDegreeEvents = Array.isArray(data.secondDegreeEvents) ? data.secondDegreeEvents : [];
  const secondDegreeRsvps = Array.isArray(data.secondDegreeRsvps) ? data.secondDegreeRsvps : [];

 

  const events = rawEvents.filter(
    (ev: any) => accessByEventId[String(ev?.id)]?.can_see === true
  );

  const invites = (Array.isArray(data.invites) ? data.invites : []).filter(
    (invite: any) => accessByEventId[String(invite?.event_id)]?.can_see === true
  );

  const socialCircles = Array.isArray(data.socialCircles) ? data.socialCircles : [];
  const relationships = Array.isArray(data.relationships) ? data.relationships : [];
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const chatSummaries = data.chatSummaries || {};

  const userEmail = toEmailLc(data.userEmail);
  const userPersonId = toPersonId(data.userPersonId);

  const viewerIdentity: FeedIdentity = {
    key: userPersonId ? `person:${userPersonId}` : userEmail ? `email:${userEmail}` : null,
    personId: userPersonId || undefined,
    personEmail: userEmail || undefined,
  };

  function isViewerIdentity(identity: FeedIdentity | null | undefined) {
    return sameIdentity(identity, viewerIdentity);
  }

  function isViewerSelf(identity: FeedIdentity | null | undefined) {
    return isViewerIdentity(identity);
  }

  const matchedContactIdentityMap = new Map<string, FeedIdentity>();

  for (const c of contacts) {
    const identity = resolveIdentity(c);
    if (!identity.key || isViewerIdentity(identity)) continue;

    if (c?.matched_user_id) {
      matchedContactIdentityMap.set(identity.key, identity);
    }
  }

  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;

  const directIdentityMap = new Map<string, FeedIdentity>();

  for (const circle of socialCircles) {
    const members = Array.isArray(circle?.members) ? circle.members : [];
    for (const member of members) {
      const identity = resolveIdentity(member);
      if (!identity.key || isViewerIdentity(identity)) continue;
      directIdentityMap.set(identity.key, identity);
    }
  }

  for (const relationship of relationships) {
    const identity = resolveIdentity(relationship);
    if (!identity.key || isViewerIdentity(identity)) continue;
    directIdentityMap.set(identity.key, identity);
  }
const secondDegreeEventIds = new Set(
  secondDegreeEvents
    .filter((ev: any) => {
      const hostIdentity = resolveIdentity({
        person_id: ev.host_person_id,
        host_email: ev.host_email,
        email_lc: ev.host_email,
      });

      return !Array.from(directIdentityMap.values()).some((directIdentity) =>
        sameIdentity(directIdentity, hostIdentity)
      );
    })
    .map((ev: any) => String(ev?.id))
    .filter(Boolean)
);
  const upcomingEvents = events.filter((ev: any) => {
    const ms = eventStartMs(ev);
    return ms === null || (ms >= now && ms <= now + fourteenDaysMs);
  });

  const upcomingEventCount = upcomingEvents.length;
  const networkActivityCount = invites.length + upcomingEventCount;
  const hasImportedContacts = contacts.length > 0;

  let directRelationshipCount = directIdentityMap.size;

  let feedState: FeedState = 'early_network';
  if (!hasImportedContacts && directRelationshipCount === 0 && upcomingEventCount === 0) {
    feedState = 'cold_start';
  } else if (
    directRelationshipCount >= 5 ||
    upcomingEventCount >= 3 ||
    networkActivityCount >= 5
  ) {
    feedState = 'mature_network';
  }

  const items: FeedItem[] = [];
  const participationByEventId = new Map<string, any[]>();

  for (const row of [...rsvps, ...secondDegreeRsvps]) {
    const evId = String(row.event_id);
    const list = participationByEventId.get(evId) || [];
    list.push({
      ...row,
      _participation_source: 'rsvp',
      _normalized_status: toEmailLc(row.status),
    });
    participationByEventId.set(evId, list);
  }

  for (const row of vibeResponses) {
    const evId = String(row.event_id);
    const list = participationByEventId.get(evId) || [];
    list.push({
      ...row,
      _participation_source: 'vibe_response',
      _normalized_status: 'voted',
    });
    participationByEventId.set(evId, list);
  }

  for (const ev of upcomingEvents) {
    const evId = String(ev.id);
    const ms = eventStartMs(ev) ?? now;
    const access = accessByEventId[evId] || {};
    const networkVisible = access.reason === 'network_qualified';

    const hostIdentity = resolveIdentity({
      person_id: ev.host_person_id,
      host_email: ev.host_email,
      email_lc: ev.host_email,
    });

    const isHost = isViewerIdentity(hostIdentity);

    const userParticipation = (participationByEventId.get(evId) || []).find((row: any) => {
      const rowIdentity = resolveIdentity(row);
      if (isViewerIdentity(rowIdentity)) return true;
      return toEmailLc(row.email_lc || row.email) === userEmail;
    });

    const status = toEmailLc(
      userParticipation?._normalized_status ?? userParticipation?.status
    );

    const countsAsMine =
      isHost ||
      ['yes', 'going', 'interested', 'maybe', 'voted', 'pending', 'requested'].includes(
        status
      );

    if (countsAsMine) {
  items.push({
    id: `upcoming_plan:${evId}`,
    type: 'upcoming_plan',
    priority: 100,
    eventId: evId,
    payload: ev,
  });
}

    if (countsAsMine && ms - now < oneDayMs) {
      items.push({
        id: `event_starting_soon:${evId}`,
        type: 'event_starting_soon',
        priority: 120,
        eventId: evId,
        payload: ev,
      });
    }

    if (countsAsMine) {
      const participantMap = new Map<string, FeedPersonRef>();

      for (const r of participationByEventId.get(evId) || []) {
        const identity = resolveIdentity(r);
        const normalizedStatus = toEmailLc(r._normalized_status ?? r.status);

        if (!identity.key || isViewerIdentity(identity)) continue;
        if (!isPositiveParticipationStatus(normalizedStatus)) continue;

        if (!participantMap.has(identity.key)) {
          participantMap.set(identity.key, makePersonFeedFields(identity));
        }
      }

      const participants = Array.from(participantMap.values());

      if (participants.length > 0) {
        items.push({
          id: `seeing_soon:${evId}`,
          type: 'seeing_soon',
          priority: 75,
          eventId: evId,
          payload: { event: ev, participants },
        });
      }
    }

    const chat = chatSummaries[evId];
    if (chat && Number(chat.unread_count || 0) > 0) {
      items.push({
        id: `unread_event_chat:${evId}`,
        type: 'unread_event_chat',
        priority: 110,
        eventId: evId,
        payload: { event: ev, chat },
      });
    }
  }

  for (const invite of invites) {
    if (toEmailLc(invite?.status || 'pending') !== 'pending') continue;

    items.push({
      id: `incoming_invite:${invite.event_id}`,
      type: 'incoming_invite',
      priority: 130,
      eventId: String(invite.event_id),
      payload: invite,
    });
  }

  const candidateEvents = events.filter((ev: any) => {
    const ms = eventStartMs(ev);
    return ms === null || (ms >= now && ms <= now + fourteenDaysMs);
  });

  for (const ev of candidateEvents) {
    const evId = String(ev.id);
    const access = accessByEventId[evId] || {};

   if (ev.visible_in_feed !== true) continue;
    

    const hostIdentity = resolveIdentity({
      person_id: ev.host_person_id,
      host_email: ev.host_email,
      email_lc: ev.host_email,
    });

    const isHost = isViewerIdentity(hostIdentity);

    const userParticipation = (participationByEventId.get(evId) || []).find((row: any) => {
      const rowIdentity = resolveIdentity(row);
      if (isViewerIdentity(rowIdentity)) return true;
      return toEmailLc(row.email_lc || row.email) === userEmail;
    });

    const status = toEmailLc(
      userParticipation?._normalized_status ?? userParticipation?.status
    );

    const countsAsMine =
      isHost ||
      ['yes', 'going', 'interested', 'maybe', 'voted', 'pending', 'requested'].includes(
        status
      );

    if (countsAsMine) continue;

    items.push({
  id: `friend_created_event:${evId}:${stablePersonRef(hostIdentity)}`,
  type: 'friend_created_event',
  priority: secondDegreeEventIds.has(evId) ? 70 : 80,
  eventId: evId,
  ...makePersonFeedFields(hostIdentity),
  payload: {
    ...ev,
    _feed_scope: secondDegreeEventIds.has(evId) ? 'second_degree' : 'direct_friend',
  },
});
  }

  const relationshipMap = new Map<string, RelationshipEntry>();

  for (const ev of rawEvents) {
    if (accessByEventId[String(ev?.id)]?.can_see !== true) continue;

    const evId = String(ev.id);
    const evMs = eventStartMs(ev);

    const hostIdentity = resolveIdentity({
      person_id: ev.host_person_id,
      host_email: ev.host_email,
      email_lc: ev.host_email,
    });

    const eventParticipation = participationByEventId.get(evId) || [];
    const userParticipation = eventParticipation.find((row: any) => {
      const rowIdentity = resolveIdentity(row);
      if (isViewerIdentity(rowIdentity)) return true;
      return toEmailLc(row.email_lc || row.email) === userEmail;
    });

    const userStatus = toEmailLc(
      userParticipation?._normalized_status ?? userParticipation?.status
    );

    const userInEvent =
      isViewerIdentity(hostIdentity) ||
      ['yes', 'going', 'interested', 'maybe', 'voted'].includes(userStatus);

    if (!userInEvent) continue;

    const sharedPeople = new Map<string, FeedIdentity>();

    if (hostIdentity.key && !isViewerIdentity(hostIdentity)) {
      sharedPeople.set(hostIdentity.key, hostIdentity);
    }

    for (const r of eventParticipation) {
      const identity = resolveIdentity(r);
      const status = toEmailLc(r._normalized_status ?? r.status);

      if (!identity.key || isViewerIdentity(identity)) continue;
      if (!isPositiveParticipationStatus(status)) continue;

      sharedPeople.set(identity.key, identity);
    }

    for (const identity of sharedPeople.values()) {
      const existing: RelationshipEntry = relationshipMap.get(identity.key!) || {
        key: identity.key!,
        personId: identity.personId,
        personEmail: identity.personEmail,
        sharedEvents: 0,
        hostedByYouCount: 0,
        hostedByThemCount: 0,
        sharedEventsActivity: [],
        lastSeenAt: null,
        lastSeenAtMs: null,
        lastSeenEventTitle: undefined,
        source: 'shared_event',
      };

      existing.sharedEvents += 1;

      let detail = 'Shared event';
      if (isViewerIdentity(hostIdentity)) {
        existing.hostedByYouCount += 1;
        detail = 'You hosted';
      } else if (sameIdentity(identity, hostIdentity)) {
        existing.hostedByThemCount += 1;
        detail = 'They hosted';
      }

      existing.sharedEventsActivity.push({
        id: `shared_event:${evId}:${stablePersonRef(identity)}`,
        title: ev.title || 'Untitled event',
        subtitle: 'Shared event',
        dateLabel: ev.starts_at || '',
        detail,
        type: 'shared_event',
      });

      if (!existing.personId && identity.personId) existing.personId = identity.personId;
      if (!existing.personEmail && identity.personEmail) existing.personEmail = identity.personEmail;

      if (evMs !== null && (existing.lastSeenAtMs === null || evMs > existing.lastSeenAtMs)) {
        existing.lastSeenAtMs = evMs;
        existing.lastSeenAt = ev.starts_at || null;
        existing.lastSeenEventTitle = ev.title || undefined;
      }

      relationshipMap.set(identity.key!, existing);
    }
  }

  for (const identity of directIdentityMap.values()) {
    if (!identity.key || isViewerIdentity(identity)) continue;

    const existing = relationshipMap.get(identity.key);

    if (existing) {
      existing.source =
        existing.source === 'shared_event' ? 'manual_and_shared_event' : existing.source;
      relationshipMap.set(identity.key, existing);
      continue;
    }

    relationshipMap.set(identity.key, {
      key: identity.key,
      personId: identity.personId,
      personEmail: identity.personEmail,
      sharedEvents: 0,
      hostedByYouCount: 0,
      hostedByThemCount: 0,
      sharedEventsActivity: [],
      lastSeenAt: null,
      lastSeenAtMs: null,
      lastSeenEventTitle: undefined,
      source: 'manual',
    });
  }

  const relationshipEntries = Array.from(relationshipMap.values())
    .filter((person) => {
      return !isViewerIdentity({
        key: person.key,
        personId: person.personId,
        personEmail: person.personEmail,
      });
    })
    .sort((a, b) => {
      if (b.sharedEvents !== a.sharedEvents) return b.sharedEvents - a.sharedEvents;
      return (b.lastSeenAtMs ?? 0) - (a.lastSeenAtMs ?? 0);
    });

  directRelationshipCount = relationshipEntries.length;

  const innerCircleTopKeys = new Set(
    relationshipEntries.slice(0, 6).map((person) => person.key)
  );

  for (const person of relationshipEntries) {
    const personRef = person.personId
      ? `person:${person.personId}`
      : person.personEmail || person.key;

    if (
      person.sharedEvents >= 1 &&
      person.lastSeenAtMs !== null &&
      now - person.lastSeenAtMs > thirtyDaysMs
    ) {
      items.push({
        id: `reconnect_person:${personRef}`,
        type: 'reconnect_person',
        priority: 65,
        personId: person.personId,
        personEmail: person.personEmail,
        payload: person,
      });
    }

    if (person.sharedEvents >= 3 || innerCircleTopKeys.has(person.key)) {
      items.push({
        id: `inner_circle_person:${personRef}`,
        type: 'inner_circle_person',
        priority: 60,
        personId: person.personId,
        personEmail: person.personEmail,
        payload: person,
      });
    }

    if (person.lastSeenAtMs !== null && now - person.lastSeenAtMs <= fourteenDaysMs) {
      items.push({
        id: `active_connection:${personRef}`,
        type: 'active_connection',
        priority: 55,
        personId: person.personId,
        personEmail: person.personEmail,
        payload: person,
      });
    }
  }

  const directRelationshipIdentityMap = new Map<string, FeedIdentity>();

  for (const person of relationshipEntries) {
    if (!person.key) continue;
    directRelationshipIdentityMap.set(person.key, {
      key: person.key,
      personId: person.personId,
      personEmail: person.personEmail,
    });
  }

  const directRelationshipNameMap = new Map<string, string>();

  for (const circle of socialCircles) {
    const members = Array.isArray(circle?.members) ? circle.members : [];
    for (const member of members) {
      const identity = resolveIdentity(member);
      const name = resolveDisplayName(member);
      if (!identity.key || !name) continue;

      const directMatch = Array.from(directRelationshipIdentityMap.values()).find((other) =>
        sameIdentity(other, identity)
      );

      if (directMatch?.key) {
        directRelationshipNameMap.set(directMatch.key, name);
      }
    }
  }

  const eventMetaById = new Map<string, any>();
  for (const ev of [...rawEvents, ...secondDegreeEvents]) {
    eventMetaById.set(String(ev.id), ev);
  }

  const positivePeopleByEventId = new Map<
    string,
    Array<{ identity: FeedIdentity; displayName?: string }>
  >();

  for (const [evId, eventParticipation] of participationByEventId.entries()) {
    const eventPeople: Array<{ identity: FeedIdentity; displayName?: string }> = [];

    function upsertEventPerson(identity: FeedIdentity, displayName?: string) {
      if (!identity.key) return;

      const existing = eventPeople.find(({ identity: other }) =>
        sameIdentity(other, identity)
      );

      if (existing) {
        if (!existing.identity.personId && identity.personId) existing.identity.personId = identity.personId;
        if (!existing.identity.personEmail && identity.personEmail) existing.identity.personEmail = identity.personEmail;
        if (!existing.displayName && displayName) existing.displayName = displayName;
        existing.identity.key = existing.identity.personId
          ? `person:${existing.identity.personId}`
          : existing.identity.personEmail
          ? `email:${existing.identity.personEmail}`
          : existing.identity.key;
        return;
      }

      eventPeople.push({
        identity: {
          key: identity.personId
            ? `person:${identity.personId}`
            : identity.personEmail
            ? `email:${identity.personEmail}`
            : identity.key,
          personId: identity.personId,
          personEmail: identity.personEmail,
        },
        displayName,
      });
    }

    const ev = eventMetaById.get(evId);

    if (ev) {
      const hostIdentity = resolveIdentity({
        person_id: ev.host_person_id,
        host_email: ev.host_email,
        email_lc: ev.host_email,
      });
      upsertEventPerson(hostIdentity, resolveDisplayName({ host_name: ev.host_name }));
    }

    for (const r of eventParticipation) {
      const identity = resolveIdentity(r);
      const status = toEmailLc(r._normalized_status ?? r.status);

      if (!identity.key) continue;
      if (!isPositiveParticipationStatus(status)) continue;

      upsertEventPerson(identity, resolveDisplayName(r));
    }

    if (eventPeople.length > 0) {
      positivePeopleByEventId.set(evId, eventPeople);
    }
  }

  const secondDegreeCandidates = new Map<
    string,
    {
      identity: FeedIdentity;
      bridges: Map<
        string,
        {
          bridgeIdentity: FeedIdentity;
          bridgeName?: string;
          eventIds: Set<string>;
          eventTitles: Set<string>;
        }
      >;
    }
  >();

  for (const bridgeIdentity of directRelationshipIdentityMap.values()) {
    if (!bridgeIdentity.key || isViewerSelf(bridgeIdentity)) continue;

    const bridgeKey = bridgeIdentity.key;
    const bridgeName = directRelationshipNameMap.get(bridgeKey);

    for (const [evId, people] of positivePeopleByEventId.entries()) {
      const bridgePresent = people.some(({ identity }) => sameIdentity(identity, bridgeIdentity));
      if (!bridgePresent) continue;

      const ev = eventMetaById.get(evId);

      for (const { identity: candidateIdentity } of people) {
        if (!candidateIdentity.key) continue;
        if (isViewerSelf(candidateIdentity)) continue;
        if (sameIdentity(candidateIdentity, bridgeIdentity)) continue;

        const isAlreadyDirect = Array.from(directRelationshipIdentityMap.values()).some((other) =>
          sameIdentity(other, candidateIdentity)
        );
        if (isAlreadyDirect) continue;

        const isMatchedContact = Array.from(matchedContactIdentityMap.values()).some((other) =>
          sameIdentity(other, candidateIdentity)
        );
        if (isMatchedContact) continue;

        const canonicalIdentity: FeedIdentity = {
          key: candidateIdentity.personId
            ? `person:${candidateIdentity.personId}`
            : candidateIdentity.personEmail
            ? `email:${candidateIdentity.personEmail}`
            : candidateIdentity.key,
          personId: candidateIdentity.personId,
          personEmail: candidateIdentity.personEmail,
        };

        const candidateKey = canonicalIdentity.key!;
        const existingCandidate = secondDegreeCandidates.get(candidateKey) || {
          identity: canonicalIdentity,
          bridges: new Map(),
        };

        const existingBridge = existingCandidate.bridges.get(bridgeKey) || {
          bridgeIdentity: {
            key: bridgeKey,
            personId: bridgeIdentity.personId,
            personEmail: bridgeIdentity.personEmail,
          },
          bridgeName,
          eventIds: new Set<string>(),
          eventTitles: new Set<string>(),
        };

        existingBridge.eventIds.add(evId);
        if (ev?.title) existingBridge.eventTitles.add(ev.title);

        existingCandidate.bridges.set(bridgeKey, existingBridge);
        secondDegreeCandidates.set(candidateKey, existingCandidate);
      }
    }
  }

  for (const { identity, bridges } of secondDegreeCandidates.values()) {
    if (!identity.key) continue;

    const bridgeList = Array.from(bridges.values()).map((bridge) => ({
      bridgePersonId: bridge.bridgeIdentity.personId,
      bridgePersonEmail: bridge.bridgeIdentity.personEmail,
      bridgeName: bridge.bridgeName,
      sharedEventCount: bridge.eventIds.size,
      sharedEventTitles: Array.from(bridge.eventTitles.values()),
    }));

    items.push({
      id: `suggested_connection:${stablePersonRef(identity)}`,
      type: 'suggested_connection',
      priority: 53,
      personId: identity.personId,
      personEmail: identity.personEmail,
      payload: {
        person_id: identity.personId ?? null,
        email_lc: identity.personEmail ?? null,
        source: 'second_degree',
        reason: 'friend_of_friend',
        mutualBridgeCount: bridgeList.length,
        bridges: bridgeList,
      },
    });
  }

  if (!hasImportedContacts && directRelationshipCount < 5) {
    items.push({
      id: 'import_contacts_prompt',
      type: 'import_contacts_prompt',
      priority: 140,
      payload: { route: '/circles' },
    });
  }

  items.push({
    id: 'quick_start_prompt',
    type: 'quick_start_prompt',
    priority: feedState === 'mature_network' ? 20 : 60,
    payload: { route: '/create' },
  });

  const sortedItems = dedupeById(items).sort((a, b) => {
    if (a.eventId && b.eventId && a.eventId === b.eventId) {
      if (a.type === 'upcoming_plan' && b.type === 'incoming_invite') return -1;
      if (a.type === 'incoming_invite' && b.type === 'upcoming_plan') return 1;
    }

    return b.priority - a.priority;
  });

  const uniqueEventItems: FeedItem[] = [];
  const seenEventIds = new Set<string>();

  for (const item of sortedItems) {
    if (item.eventId) {
      if (seenEventIds.has(item.eventId)) continue;
      seenEventIds.add(item.eventId);
    }

    uniqueEventItems.push(item);
  }

  return {
    feedState,
    meta: {
      contactCount: input.deviceContactCount,
      friendCount: directRelationshipCount,
      upcomingEventCount,
      networkActivityCount,
    },
    items: uniqueEventItems,
  };
}