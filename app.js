import 'dotenv/config';
import fetch from 'node-fetch';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, DiscordRequest } from './utils.js';
import {
    TEST_COMMAND,
    HasGuildCommands,
    WOW_COMMAND,
  } from './commands.js';
  

// Create an express app
const app = express();

// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
 app.post('/interactions', async function (req, res) {
     // Interaction type and data
    const { type, id, data } = req.body;

    /**
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

      /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        // "test" guild command
        if (name === 'test') {
            // Send a message into the channel where command was triggered from
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: 'Wow! ',
                },
            });
        }

        if (name === 'wow') {
            try {
                const wowResponse = await fetch('https://owen-wilson-wow-api.herokuapp.com/wows/random');
                const wowData = await wowResponse.json();
                console.log(wowData);
                
                for (const wow of wowData) {
                    // Send a message into the channel where command was triggered from
                    return res.send({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: `> ${wow.full_line}\n> ~ Owen Wowson ("${wow.movie}" at ${wow.timestamp})\n${wow.poster}`,
                        },
                    });
                }
            } catch (e) {
                console.error(e);
                return res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: 'Wow! Something went wrong!',
                    },
                });
            }
        }
    }
});

app.listen(3000, () => {
    console.log('Listening on port 3000');
  
    // Check if guild commands from commands.json are installed (if not, install them)
    HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
      TEST_COMMAND,
      WOW_COMMAND,
    ]);
});
