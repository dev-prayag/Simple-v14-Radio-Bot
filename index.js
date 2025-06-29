import { Client, GatewayIntentBits, REST, Routes, InteractionType } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, StreamType } from '@discordjs/voice';
import prism from 'prism-media';
import dotenv from 'dotenv';
import Prayag from 'prayag';
import { radioCommand, stopCommand } from './commands/radio.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const db = new Prayag();
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const commands = [radioCommand, stopCommand];
const players = new Map();

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered!');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // 🔥 AUTO-RESUME on startup
  for (const [guildId, guild] of client.guilds.cache) {
    const lastStation = db.get(`lastStation:${guildId}`);
    const lastVC = db.get(`lastVC:${guildId}`);

    if (lastStation && lastVC) {
      const channel = await guild.channels.fetch(lastVC).catch(() => null);
      if (channel && channel.isVoiceBased()) {
        console.log(`▶️ Auto-resuming in ${guild.name} → ${lastStation}`);

        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator
        });

        const ffmpeg = new prism.FFmpeg({
          args: [
            '-i', lastStation,
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2'
          ]
        });

        const resource = createAudioResource(ffmpeg, { inputType: StreamType.Raw });
        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);
        players.set(guildId, player);

        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

        console.log(`✅ Resumed in ${guild.name}`);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.type !== InteractionType.ApplicationCommand) return;

  if (interaction.commandName === 'radio') {
    const station = interaction.options.getString('station');
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply({ content: '❌ Join a voice channel first.', ephemeral: true });

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    const ffmpeg = new prism.FFmpeg({
      args: [
        '-i', station,
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2'
      ]
    });

    const resource = createAudioResource(ffmpeg, { inputType: StreamType.Raw });
    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);
    players.set(interaction.guildId, player);

    db.set(`lastStation:${interaction.guildId}`, station);
    db.set(`lastVC:${interaction.guildId}`, channel.id);

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    interaction.reply(`▶️ Now playing: ${station}`);
  }

  if (interaction.commandName === 'stop') {
    const player = players.get(interaction.guildId);
    if (player) {
      player.stop();
      players.delete(interaction.guildId);
    }

    db.delete(`lastStation:${interaction.guildId}`);
    db.delete(`lastVC:${interaction.guildId}`);

    interaction.reply(`⏹️ Stopped radio and cleared auto-resume.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
