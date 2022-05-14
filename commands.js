import { DiscordRequest } from './utils.js';
import assert from 'node:assert/strict';

export async function getGuildCommands(appId, guildId) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  const availableCommands = {};

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();
    data?.forEach((command) => {
      assert('name' in command);
      availableCommands[command.name] = command;
    })
  } catch (err) {
    console.error(err);
  }
  return availableCommands;
}

export async function installGuildCommand(appId, guildId, commandName, dryRun=false) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  try {
    console.log("Installing " + commandName);
    assert(commandName in COMMAND_LAYOUTS);
    const commandToInstall = COMMAND_LAYOUTS[commandName];
    if (dryRun) {
      console.log(`await DiscordRequest(${endpoint}, { method: 'POST', body: ${commandToInstall} });`)
      return;
    }
    await DiscordRequest(endpoint, { method: 'POST', body: commandToInstall });
  } catch (err) {
    console.error(err);
  }
}

export async function updateGuildCommand(appId, guildId, command, dryRun=false) {
  assert('id' in command);
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${command.id}`;
  try {
    console.log('Updating ' + command.name);
    assert(command.name in COMMAND_LAYOUTS);
    const commandToUpdate = COMMAND_LAYOUTS[command.name];
    if (dryRun) {
      console.log(`await DiscordRequest(${endpoint}, { method: 'PATCH', body: ${commandToUpdate} });`);
      return;
    }
    await DiscordRequest(endpoint, { method: 'PATCH', body: commandToUpdate });
  } catch (err) {
    console.error(err);
  }
}

export async function deleteGuildCommand(appId, guildId, command, dryRun=false) {
  assert('id' in command);
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${command.id}`;
  try {
    console.log("Deleting " + command.name);
    if (dryRun) {
      console.log(`await DiscordRequest(${endpoint}, { method: 'DELETE' });`);
      return;
    }
    await DiscordRequest(endpoint, { method: 'DELETE' });
  } catch (err) {
    console.error(err);
  }
}

export const COMMAND_LAYOUTS = {
  wowson: {
    name: 'wowson',
    description: 'Wow!',
    type: 1,
    options: [
      {
        name: 'num_wows',
        description: 'Wow wow!',
        type: 4,
      },
    ],
  },
  wow: {
    name: 'wow',
    description: "Wow that's what I call music!",
    type: 1,
    options: [
      {
        name: 'play',
        description: 'Wow wow! Play a song or album!',
        type: 1,
        options: [{
          name: 'music',
          description: 'Song or album to play',
          type: 3,
          required: false,
        }],
      },
      {
        name: 'stop',
        description: 'Wow! Make it stop!',
        type: 1,
      },
      {
        name: 'clear',
        description: 'Wow! Clear the queue!',
        type: 1,
      },
      {
        name: 'skip',
        description: 'Wow! Next!',
        type: 1,
      },
      {
        name: 'pause',
        description: 'Wow! Hold up!',
        type: 1,
      },
      {
        name: 'unpause',
        description: 'Wow! Proceed!',
        type: 1,
      },
      {
        name: 'np',
        description: 'Wow Playing!',
        type: 1,
      },
      {
        name: 'playskip',
        description: 'Wow! Play now!',
        type: 1,
      }
    ],
  },
};
