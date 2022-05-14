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

export async function deleteGuildCommand(appId, guildId, command, dryRun=true) {
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
  wow: {
    name: 'wow',
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
  wowmix: {
    name: 'wowmix',
    description: "Wow that's what I call music!",
    type: 1,
    options: [
      {
        name: 'music',
        description: 'Wow wow! Type a song or album!',
        type: 3,
        required: true,
      },
    ],
  },
  wowstop: {
    name: 'wowstop',
    description: "Wow! Make it stop!",
    type: 1,
  },
  wowclear: {
    name: 'wowclear',
    description: "Wow! Clear the queue!",
    type: 1,
  }
};
