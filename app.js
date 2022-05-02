import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { deleteGuildCommand } from './commands.js';

const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

client.once('ready', () => {
    // Check if guild commands from commands.json are installed (if not, install them)
    // HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    //     WOW_COMMAND,
    // ]);
    deleteGuildCommand(process.env.APP_ID, process.env.GUILD_ID, '970391289868738560');
    console.log('Ready!');
});

client.login(process.env.DISCORD_TOKEN);

let connection = null;
const player = createAudioPlayer();
const queue = [];
let timer = null;

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
    
	if (interaction.commandName === 'wow') {
        clearTimeout(timer);
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        const wowResponse = await fetch('https://owen-wilson-wow-api.herokuapp.com/wows/random?results=5');
        const wowData = await wowResponse.json();
        let i = 0;
        for (const wow of wowData) {
            await downloadFile(wow.audio, `test${i}.mp3`)

            if (queue.length > 0 || i > 0) {
                queue.push(`test${i}.mp3`);
            } else {
                const resource = createAudioResource(`test${i}.mp3`, {
                    metadata: {
                        title: 'A good song!',
                    },
                });
                player.play(resource);
            }
            i++;
        }
		await interaction.reply('Wow!');
	}
});

player.on(AudioPlayerStatus.Idle, () => {
    if (queue.length > 0) {
        const filename = queue.shift();
        const resource = createAudioResource(filename, {
            metadata: {
                title: 'A good song!',
            },
        });
        player.play(resource);
    } else {
        timer = setTimeout(() => {
            player?.stop();
            connection?.destroy();
        }, 1000 * 30);
    }
});
