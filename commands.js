import { DiscordRequest } from './utils.js';

export async function HasGuildCommands(appId, guildId, commands) {
  if (guildId === '' || appId === '') return;

  commands.forEach((c) => HasGuildCommand(appId, guildId, c));
}

// Checks for a command
async function HasGuildCommand(appId, guildId, command, shouldUpdate=false) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();

    if (data) {
      const installedNames = data.map((c) => c['name']);
      // This is just matching on the name, so it's not good for updates
      if (!installedNames.includes(command['name'])) {
        console.log(`Installing "${command['name']}"`);
        InstallGuildCommand(appId, guildId, command);
      } else if (shouldUpdate) {
        console.log(`"${command['name']}" command already installed, deleting and re-installing`);
        const existingCommand = data.find((c) => c['name'] === command['name']);
        updateGuildCommand(appId, guildId, existingCommand['id'], command)
      } else {
        console.log(`"${command['name']}" command already installed`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Installs a command
export async function InstallGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  // install command
  try {
    console.log("install")
    await DiscordRequest(endpoint, { method: 'POST', body: command });
  } catch (err) {
    console.error(err);
  }
}

export async function updateGuildCommand(appId, guildId, commandId, command) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`;
  try {
    console.log('update id ' + commandId)
    await DiscordRequest(endpoint, { method: 'PATCH', body: command });
  } catch (err) {
    console.error(err);
  }
}

export async function deleteGuildCommand(appId, guildId, commandId) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`;
  try {
    console.log('delete id ' + commandId)
    await DiscordRequest(endpoint, { method: 'DELETE' });
  } catch (err) {
    console.error(err);
  }
}

export const WOW_COMMAND = {
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
};

export const WOWMIX_COMMAND = {
  name: 'wowmix',
  description: "Wow that's what I call music!",
  type: 1,
  options: [
    {
      name: 'neil',
      description: 'Wow wow!',
      type: 2,
    },
  ],
};
