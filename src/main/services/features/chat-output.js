import { getSettings } from '../../store';
import { sendChatMessage } from '../twitch/api';
import { logger } from '../logger';
import { errorMessage, renderTemplate } from '../template';

const sentIds = new Set();

export function isOwnMessage(messageId) {
  return sentIds.has(messageId);
}

// Sendet eine konfigurierte Nachricht, sofern Chatnachrichten aktiviert und der Text nicht leer ist.
export async function say(key, vars = {}) {
  const chat = getSettings('chat');
  if (!chat.messagesEnabled) return;
  const text = renderTemplate(chat.messages[key], vars);
  if (!text) return;
  try {
    const id = await sendChatMessage(text);
    sentIds.add(id);
    if (sentIds.size > 100) sentIds.delete(sentIds.values().next().value);
    logger.info('chat', `Chatnachricht gesendet: ${text}`);
  } catch (error) {
    logger.error('chat', `Chatnachricht konnte nicht gesendet werden: ${errorMessage(error)}`);
  }
}
