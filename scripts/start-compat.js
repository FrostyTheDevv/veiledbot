console.error([
  'The Discord migration runner is not wired yet.',
  'VeiledBot currently exposes an adapter library, but it does not connect a Discord client.',
  'Use "npm run veiled" to start the Veiled-only showcase bot.'
].join('\n'));
process.exitCode = 1;
