const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ خطأ: متغير البيئة TOKEN غير موجود! أضفه في إعدادات Render.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إرسال أزرار التحكم')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const pendingActions = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// تحويل المدخلات الرقمية الكبيرة إلى عدد صحيح آمن أو Infinity عند كتابة رقم هائل جداً
function parseUnboundedCount(raw) {
  const cleaned = String(raw ?? '').trim().replace(/[,_\s]/g, '');
  if (!cleaned) return NaN;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    return cleaned.toLowerCase().includes('inf') ? Infinity : NaN;
  }
  if (num < 1) return NaN;
  if (num > Number.MAX_SAFE_INTEGER) return Infinity;
  return Math.floor(num);
}

client.once('ready', async () => {
  console.log(`✅ تم تسجيل الدخول كـ: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ تم تسجيل أمر /panel بنجاح.');
  } catch (err) {
    console.error('❌ فشل تسجيل الأوامر:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    // إرسال الأزرار فقط بدون أي Embed أو نصوص إضافية
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌',
          flags: MessageFlags.Ephemeral
        });
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_add_channels_bulk')
          .setLabel('إضافة روم')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_del_all_channels')
          .setLabel('حذف روم')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('btn_add_roles_bulk')
          .setLabel('إضافة رول')
          .setEmoji('🎭')
          .setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_del_all_roles')
          .setLabel('حذف رتبة')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_ban_all_members')
          .setLabel('حظر عضو')
          .setEmoji('🔨')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('btn_send_messages')
          .setLabel('إرسال رسائل')
          .setEmoji('📨')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        components: [row1, row2]
      });
      return;
    }

    if (interaction.isButton()) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌',
          flags: MessageFlags.Ephemeral
        });
      }

      // 1) إضافة عدة رومات بنفس الاسم بعدد غير محدد
      if (interaction.customId === 'btn_add_channels_bulk') {
        const modal = new ModalBuilder()
          .setCustomId('modal_add_channels_bulk')
          .setTitle('إضافة رومات');

        const countInput = new TextInputBuilder()
          .setCustomId('channels_count')
          .setLabel('كم تريد أن تنشئ من روم؟ (عدد غير محدد)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 10 أو 1000000000')
          .setRequired(true);

        const nameInput = new TextInputBuilder()
          .setCustomId('channels_name')
          .setLabel('اسم جميع الرومات')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: general')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(countInput),
          new ActionRowBuilder().addComponents(nameInput)
        );
        return interaction.showModal(modal);
      }

      // 2) إضافة عدة رولات بنفس الاسم بعدد غير محدد
      if (interaction.customId === 'btn_add_roles_bulk') {
        const modal = new ModalBuilder()
          .setCustomId('modal_add_roles_bulk')
          .setTitle('إضافة رولات');

        const countInput = new TextInputBuilder()
          .setCustomId('roles_count')
          .setLabel('كم تريد أن تنشئ من رول؟ (عدد غير محدد)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 10 أو 1000000000')
          .setRequired(true);

        const nameInput = new TextInputBuilder()
          .setCustomId('roles_name')
          .setLabel('اسم جميع الرولات')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: VIP')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(countInput),
          new ActionRowBuilder().addComponents(nameInput)
        );
        return interaction.showModal(modal);
      }

      // 3) تأكيد حذف جميع الرومات
      if (interaction.customId === 'btn_del_all_channels') {
        pendingActions.set(interaction.user.id, { type: 'delete_all_channels' });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد حذف جميع الرومات')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: '⚠️ تأكيد: حذف جميع الرومات في السيرفر؟',
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }

      // 4) تأكيد حذف جميع الرولات
      if (interaction.customId === 'btn_del_all_roles') {
        pendingActions.set(interaction.user.id, { type: 'delete_all_roles' });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد حذف جميع الرولات')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: '⚠️ تأكيد: حذف جميع الرولات القابلة للحذف في السيرفر؟',
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }

      // 5) تأكيد حظر جميع الأعضاء القابلين للحظر
      if (interaction.customId === 'btn_ban_all_members') {
        pendingActions.set(interaction.user.id, { type: 'ban_all_members' });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد حظر الأعضاء')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: '⚠️ تأكيد: حظر جميع الأعضاء القابلين للحظر في السيرفر؟',
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }

      // 6) إرسال رسائل: نص الرسالة + عدد الرسائل في كل روم + عدد الشانيلات
      if (interaction.customId === 'btn_send_messages') {
        const modal = new ModalBuilder()
          .setCustomId('modal_send_messages')
          .setTitle('إرسال رسائل');

        const msgInput = new TextInputBuilder()
          .setCustomId('message_text')
          .setLabel('نص الرسالة التي ترسلها')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('اكتب نص الرسالة هنا...')
          .setRequired(true);

        const msgCountInput = new TextInputBuilder()
          .setCustomId('message_count')
          .setLabel('عدد الرسائل في كل روم (غير محدد)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 5 أو 1000000000')
          .setRequired(true);

        const channelCountInput = new TextInputBuilder()
          .setCustomId('channels_target_count')
          .setLabel('عدد الشانيلات التي ترسل فيها (غير محدد)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 3 أو 1000000000')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(msgInput),
          new ActionRowBuilder().addComponents(msgCountInput),
          new ActionRowBuilder().addComponents(channelCountInput)
        );
        return interaction.showModal(modal);
      }

      // تنفيذ التأكيد
      if (interaction.customId === 'confirm_action') {
        const actionData = pendingActions.get(interaction.user.id);
        if (!actionData) {
          return interaction.reply({
            content: '⚠️ انتهت مهلة التأكيد.',
            flags: MessageFlags.Ephemeral
          });
        }

        pendingActions.delete(interaction.user.id);

        if (actionData.type === 'delete_all_channels') {
          await interaction.update({ content: '⏳ جاري حذف الرومات...', components: [] });
          let deleted = 0;
          const channels = [...interaction.guild.channels.cache.values()];

          for (const ch of channels) {
            try {
              await ch.delete('حذف جماعي من لوحة الإدارة');
              deleted++;
              await sleep(250);
            } catch (_) {}
          }

          return interaction.followUp({
            content: `✅ تم حذف ${deleted} روم.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (actionData.type === 'delete_all_roles') {
          await interaction.update({ content: '⏳ جاري حذف الرولات...', components: [] });
          let deleted = 0;
          const roles = [...interaction.guild.roles.cache.values()].filter(
            (r) => r.id !== interaction.guild.id && r.editable && !r.managed
          );

          for (const role of roles) {
            try {
              await role.delete('حذف جماعي من لوحة الإدارة');
              deleted++;
              await sleep(250);
            } catch (_) {}
          }

          return interaction.followUp({
            content: `✅ تم حذف ${deleted} رتبة.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (actionData.type === 'ban_all_members') {
          await interaction.update({ content: '⏳ جاري حظر الأعضاء...', components: [] });
          await interaction.guild.members.fetch();
          let banned = 0;

          for (const [, member] of interaction.guild.members.cache) {
            if (
              member.id === interaction.guild.ownerId ||
              member.id === client.user.id ||
              member.id === interaction.user.id ||
              !member.bannable
            ) {
              continue;
            }

            try {
              await member.ban({ reason: `حظر جماعي بواسطة ${interaction.user.tag}` });
              banned++;
              await sleep(300);
            } catch (_) {}
          }

          return interaction.followUp({
            content: `✅ تم حظر ${banned} عضو.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      if (interaction.customId === 'cancel_action') {
        pendingActions.delete(interaction.user.id);
        return interaction.update({
          content: '🛑 تم الإلغاء.',
          components: []
        });
      }
    }

    if (interaction.isModalSubmit()) {
      // تنفيذ إنشاء رومات بنفس الاسم بعدد غير محدد
      if (interaction.customId === 'modal_add_channels_bulk') {
        const targetCount = parseUnboundedCount(
          interaction.fields.getTextInputValue('channels_count')
        );
        const channelName = interaction.fields.getTextInputValue('channels_name').trim();

        if (isNaN(targetCount) || targetCount < 1) {
          return interaction.reply({
            content: '❌ أدخل عدداً صحيحاً أكبر من أو يساوي 1.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.reply({
          content: `⏳ جاري إنشاء الرومات باسم \`${channelName}\`...`,
          flags: MessageFlags.Ephemeral
        });

        let created = 0;
        for (let i = 0; i < targetCount; i++) {
          try {
            await interaction.guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText
            });
            created++;
            if (created % 25 === 0) {
              console.log(`➕ تم إنشاء ${created} روم باسم ${channelName}`);
            }
            await sleep(250);
          } catch (_) {}
        }

        return interaction.followUp({
          content: `✅ تم إنشاء ${created} روم باسم \`${channelName}\`.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // تنفيذ إنشاء رولات بنفس الاسم بعدد غير محدد
      if (interaction.customId === 'modal_add_roles_bulk') {
        const targetCount = parseUnboundedCount(
          interaction.fields.getTextInputValue('roles_count')
        );
        const roleName = interaction.fields.getTextInputValue('roles_name').trim();

        if (isNaN(targetCount) || targetCount < 1) {
          return interaction.reply({
            content: '❌ أدخل عدداً صحيحاً أكبر من أو يساوي 1.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.reply({
          content: `⏳ جاري إنشاء الرولات باسم \`${roleName}\`...`,
          flags: MessageFlags.Ephemeral
        });

        let created = 0;
        for (let i = 0; i < targetCount; i++) {
          try {
            await interaction.guild.roles.create({ name: roleName });
            created++;
            if (created % 25 === 0) {
              console.log(`🎭 تم إنشاء ${created} رول باسم ${roleName}`);
            }
            await sleep(250);
          } catch (_) {}
        }

        return interaction.followUp({
          content: `✅ تم إنشاء ${created} رول باسم \`${roleName}\`.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // تنفيذ إرسال الرسائل: نص الرسالة + عدد الرسائل في كل روم + عدد الشانيلات
      if (interaction.customId === 'modal_send_messages') {
        const messageText = interaction.fields.getTextInputValue('message_text').trim();
        const messagesPerChannel = parseUnboundedCount(
          interaction.fields.getTextInputValue('message_count')
        );
        const channelsLimit = parseUnboundedCount(
          interaction.fields.getTextInputValue('channels_target_count')
        );

        if (
          isNaN(messagesPerChannel) ||
          messagesPerChannel < 1 ||
          isNaN(channelsLimit) ||
          channelsLimit < 1
        ) {
          return interaction.reply({
            content: '❌ أدخل أعداداً صحيحة أكبر من أو تساوي 1 لعدد الرسائل وعدد الشانيلات.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.reply({
          content: '⏳ جاري إرسال الرسائل...',
          flags: MessageFlags.Ephemeral
        });

        const allTextChannels = [...interaction.guild.channels.cache.values()].filter(
          (ch) =>
            ch.isTextBased() &&
            !ch.isThread() &&
            ch.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)
        );

        const targetChannels =
          channelsLimit === Infinity
            ? allTextChannels
            : allTextChannels.slice(0, channelsLimit);

        let sentTotal = 0;
        for (const ch of targetChannels) {
          for (let i = 0; i < messagesPerChannel; i++) {
            try {
              await ch.send(messageText);
              sentTotal++;
              if (sentTotal % 50 === 0) {
                console.log(`📨 تم إرسال ${sentTotal} رسالة حتى الآن`);
              }
              await sleep(250);
            } catch (_) {
              break;
            }
          }
        }

        return interaction.followUp({
          content: `✅ تم إرسال ${sentTotal} رسالة عبر ${targetChannels.length} شانيل.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ تعذر تنفيذ العملية.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
