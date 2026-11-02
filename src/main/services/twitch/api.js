import { getStore } from '../../store';
import { ensureValidToken, getAccessToken, getIdentity } from './auth';

const BASE_URL = 'https://api.twitch.tv/helix';

export class TwitchApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function helix(method, path, { query, body } = {}, canRetry = true) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Client-Id': getStore('twitchAuth').get('clientId'),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && canRetry) {
    await ensureValidToken();
    return helix(method, path, { query, body }, false);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new TwitchApiError(response.status, data.message || response.statusText, data.error);
  }
  return response.status === 204 ? null : response.json();
}

export async function sendChatMessage(text) {
  // Vor jedem Sendeversuch wird das Token validiert.
  await ensureValidToken();
  const user = getIdentity();
  const result = await helix('POST', '/chat/messages', {
    body: { broadcaster_id: user.id, sender_id: user.id, message: text.slice(0, 500) }
  });
  const sent = result.data?.[0];
  if (!sent?.is_sent) {
    throw new TwitchApiError(
      200,
      sent?.drop_reason?.message || 'Nachricht wurde von Twitch verworfen'
    );
  }
  return sent.message_id;
}

export async function getManageableRewards() {
  const result = await helix('GET', '/channel_points/custom_rewards', {
    query: { broadcaster_id: getIdentity().id, only_manageable_rewards: 'true' }
  });
  return result.data ?? [];
}

export async function createReward(reward) {
  const result = await helix('POST', '/channel_points/custom_rewards', {
    query: { broadcaster_id: getIdentity().id },
    body: reward
  });
  return result.data[0];
}

export async function updateReward(id, reward) {
  const result = await helix('PATCH', '/channel_points/custom_rewards', {
    query: { broadcaster_id: getIdentity().id, id },
    body: reward
  });
  return result.data[0];
}

export async function deleteReward(id) {
  await helix('DELETE', '/channel_points/custom_rewards', {
    query: { broadcaster_id: getIdentity().id, id }
  });
}

export async function setRedemptionStatus(redemptionId, rewardId, status) {
  await helix('PATCH', '/channel_points/custom_rewards/redemptions', {
    query: { id: redemptionId, broadcaster_id: getIdentity().id, reward_id: rewardId },
    body: { status }
  });
}

export async function createSubscription(type, version, condition, sessionId) {
  return helix('POST', '/eventsub/subscriptions', {
    body: { type, version, condition, transport: { method: 'websocket', session_id: sessionId } }
  });
}
