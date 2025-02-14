const { modChannelId, modRoleId } = require('../../config.json');
const ms = require('ms');
const { updatePunishmentLogs } = require('../helpers/dbModel');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

/**
 * Mutes a user from the server, adding a record to the database.
 *
 * @param interaction		The interaction object.
 * @param member			The member to mute.
 * @param duration			The duration of the mute.
 * @param reason			The reason for the mute.
 * @param shame				Whether or not to shame the user in chat.
 * @returns {Promise<void>} Returns a message to chat.
 */
const timeoutUser = (interaction, member, duration, reason, shame) => {
	updatePunishmentLogs(member.id, 'timesTimeout');
	member.timeout(duration, reason)
		.then(memberMuted => {
			if (shame === 'yes') {
				return interaction.reply({ content: `**${memberMuted.user?.tag ?? memberMuted.tag ?? memberMuted}** has been muted.\n**Duration:** ${ms(duration, { long: true })}\n**Reason:** ${reason}` });
			}
			return interaction.reply({ content: `**${memberMuted.user?.tag ?? memberMuted.tag ?? memberMuted}** has been muted.\n**Duration:** ${ms(duration, { long: true })}\n**Reason:** ${reason}`, ephemeral: true });
		})
		.catch(console.error);

};

/**
 * Logs the mute to the mod channel.
 *
 * @param interaction 		The interaction object.
 * @param user				The user that got muted.
 * @param duration			The duration of the mute.
 * @param reason			The reason for the mute.
 * @returns {Promise<void>} Returns a message to chat.
 */
const logToModChannel = (interaction, user, duration, reason) => {
	try {
		const embed = new EmbedBuilder()
			.setAuthor({ name: user.tag, iconURL:user.displayAvatarURL() })
			.setColor(0xbc95ff)
			.setDescription(`User has been muted.\n**Duration:** ${ms(duration, { long: true })}\n**Reason:** ${reason}\n**Mute Author:** ${interaction.member}`)
			.setTimestamp(interaction.createdTimestamp)
			.setFooter({ text: 'The bot creator doesnt like logging :(' });

		if (!modChannelId) {
			console.log('modChannelId is not specified in config.json. Cannot log timeouts.');
			return;
		}

		interaction.guild.channels.fetch(modChannelId)
			.then(channel => {
				channel.send({ embeds: [embed] });
			})
			.catch(console.error);
	}
	catch (e) {
		console.error(e);
	}
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('timeout')
		.setDescription('Timeout a specified user.')
		.setDefaultPermission(false)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user to timeout.')
				.setRequired(true),
		)
		.addStringOption(option =>
			option.setName('duration')
				.setDescription('The timeout length. e.g. 30m or 1d:1h:1m:1s.')
				.setRequired(true),
		)
		.addStringOption(option =>
			option.setName('reason')
				.setDescription('The timeout reason. This gets sent to the user anonymously.')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('shame')
				.setDescription('Shames the user in chat. Posts to wherever command is called.')
				.addChoices(
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value:  'no' },
				)),
	async execute(interaction) {
		if (!interaction.member.roles.cache.has(modRoleId)) {
			return interaction.reply({
				content: 'You do not have enough permissions to use this command.',
				ephemeral: true,
			});
		}

		const user = interaction.options.getUser('user');
		const strDuration = interaction.options.getString('duration');
		const duration = strDuration.split(':').reduce((partialSum, currentVal) => partialSum + ms(currentVal), 0);
		const reason = interaction.options.getString('reason');
		const shame = interaction.options.getString('shame');

		interaction.guild.members.fetch(user).then(member => {
			if (member.roles.cache.has(modRoleId)) {
				return interaction.reply({
					content: 'You cannot timeout this person.',
					ephemeral: true,
				});
			}
			else {
				member.send(`**You've been muted from ${interaction.guild.name}.**\n**Reason:** ${reason}`)
					.then(() => {
						timeoutUser(interaction, member, duration, reason, shame);
						logToModChannel(interaction, user, duration, reason);
					})
					.catch(() => {
						console.error(`Can't DM ${user}.`);
						timeoutUser(interaction, member, duration, reason, shame);
						logToModChannel(interaction, user, duration, reason);
					});
			}
		});


	},
};