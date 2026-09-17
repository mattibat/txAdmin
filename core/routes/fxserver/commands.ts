const modulename = 'WebServer:FXServerCommands';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiToastResp } from '@shared/genericApiTypes';
const console = consoleFactory(modulename);


type CommandAction = {
    permission: string;
    handler: (ctx: AuthedCtx, parameter: string) => ApiToastResp;
};

const commandActions: Record<string, CommandAction> = {
    admin_broadcast: {
        permission: 'announcement',
        handler: (ctx, parameter) => {
            const message = parameter.trim();

            // Dispatch `txAdmin:events:announcement`
            txCore.fxRunner.sendEvent('announcement', {
                message,
                author: ctx.admin.name,
            });
            ctx.admin.logAction(`Sending announcement: ${parameter}`);

            // Sending discord announcement
            const publicAuthor = txCore.adminStore.getAdminPublicName(ctx.admin.name, 'message');
            txCore.discordBot.sendAnnouncement({
                type: 'info',
                title: {
                    key: 'nui_menu.misc.announcement_title',
                    data: { author: publicAuthor }
                },
                description: message
            });

            return { type: 'success', msg: 'Announcement command sent.' };
        },
    },
    kick_all: {
        permission: 'control.server',
        handler: (ctx, parameter) => {
            const kickReason = parameter.trim() || txCore.translator.t('kick_messages.unknown_reason');
            const dropMessage = txCore.translator.t(
                'kick_messages.everyone',
                { reason: kickReason }
            );
            ctx.admin.logAction(`Kicking all players: ${kickReason}`);
            // Dispatch `txAdmin:events:playerKicked`
            txCore.fxRunner.sendEvent('playerKicked', {
                target: -1,
                author: ctx.admin.name,
                reason: kickReason,
                dropMessage,
            });
            return { type: 'success', msg: 'Kick All command sent.' };
        },
    },
    restart_res: {
        permission: 'commands.resources',
        handler: (ctx, parameter) => {
            ctx.admin.logAction(`Restarted resource "${parameter}"`);
            txCore.fxRunner.sendCommand('restart', [parameter], ctx.admin.name);
            return { type: 'warning', msg: 'Resource restart command sent.' };
        },
    },
    start_res: {
        permission: 'commands.resources',
        handler: (ctx, parameter) => {
            ctx.admin.logAction(`Started resource "${parameter}"`);
            txCore.fxRunner.sendCommand('start', [parameter], ctx.admin.name);
            return { type: 'warning', msg: 'Resource start command sent.' };
        },
    },
    ensure_res: {
        permission: 'commands.resources',
        handler: (ctx, parameter) => {
            ctx.admin.logAction(`Ensured resource "${parameter}"`);
            txCore.fxRunner.sendCommand('ensure', [parameter], ctx.admin.name);
            return { type: 'warning', msg: 'Resource ensure command sent.' };
        },
    },
    stop_res: {
        permission: 'commands.resources',
        handler: (ctx, parameter) => {
            ctx.admin.logAction(`Stopped resource "${parameter}"`);
            txCore.fxRunner.sendCommand('stop', [parameter], ctx.admin.name);
            return { type: 'warning', msg: 'Resource stop command sent.' };
        },
    },
    refresh_res: {
        permission: 'commands.resources',
        handler: (ctx) => {
            ctx.admin.logAction(`Refreshed resources`);
            txCore.fxRunner.sendCommand('refresh', [], ctx.admin.name);
            return { type: 'warning', msg: 'Refresh command sent.' };
        },
    },
};


/**
 * Handle all the server commands
 */
export default async function FXServerCommands(ctx: AuthedCtx) {
    if (
        typeof ctx.request.body.action !== 'string'
        || typeof ctx.request.body.parameter !== 'string'
    ) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'Invalid request.',
        });
    }
    const action = ctx.request.body.action;
    const parameter = ctx.request.body.parameter;

    //Ignore commands when the server is offline
    if (!txCore.fxRunner.child?.isAlive) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'The server is not running.',
        });
    }

    //Block starting/restarting the 'runcode' resource
    const unsafeActions = ['restart_res', 'start_res', 'ensure_res'];
    if (unsafeActions.includes(action) && parameter.includes('runcode')) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'The resource "runcode" might be unsafe. <br> If you know what you are doing, run it via the Live Console.',
        });
    }

    const command = commandActions[action];
    if (!command) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'Unknown Action.',
        });
    }
    if (!ctx.admin.testPermission(command.permission, modulename)) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'You don\'t have permission to execute this action.',
        });
    }

    return ctx.send<ApiToastResp>(command.handler(ctx, parameter));
};
