// Event names emitted by Veiled's bot gateway today. This is not a Discord
// Gateway event list; unsupported Discord events are not emitted by Veiled.
export const GATEWAY_EVENT_NAMES = Object.freeze([
  'MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE',
  'MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE', 'TYPING_START', 'VOICE_ROSTER_UPDATE',
  'LANE_CREATE', 'LANE_UPDATE', 'LANE_DELETE', 'LANE_REORDER',
  'ROOM_UPDATE', 'ROOM_DELETE', 'ROOM_EXPRESSIONS_UPDATE', 'ROOM_JOIN_REQUEST_UPDATE',
  'MEMBER_JOIN', 'MEMBER_LEAVE', 'MEMBER_BAN', 'MEMBER_UNBAN', 'MEMBER_TIMEOUT',
  'MEMBER_ROLE_ADD', 'MEMBER_ROLE_REMOVE', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE',
  'ROLE_POSITIONS_UPDATE', 'AUTOMOD_RULE_CREATE', 'AUTOMOD_RULE_UPDATE', 'AUTOMOD_RULE_DELETE',
  'RAID_DETECTED', 'RAID_ENDED', 'SCHEDULED_EVENT_UPDATE', 'BOT_ROOM_ADD', 'BOT_ROOM_REMOVE',
  'INTERACTION_CREATE',
]);

const knownEvents = new Set(GATEWAY_EVENT_NAMES);

export function isGatewayEventName(value) {
  return typeof value === 'string' && knownEvents.has(value);
}
