import { eventSource } from '@sillytavern/script';
import { SlashCommand } from '@sillytavern/scripts/slash-commands/SlashCommand';
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from '@sillytavern/scripts/slash-commands/SlashCommandArgument';
import { SlashCommandParser } from '@sillytavern/scripts/slash-commands/SlashCommandParser';

export async function slashEventEmit(named_args: any): Promise<any> {
  const event: string = named_args.event;
  const data: string[] = named_args.data ?? [];

  eventSource.emit(event, ...data);

  console.info(`[Event][/event-emit] Sent '${event}' event with data: ${JSON.stringify(data)}`);

  return event;
}

export function initSlashEventEmit() {
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'event-emit',
      callback: slashEventEmit,
      returns: 'Name of the event sent',
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'event',
          description: 'event name',
          typeList: [ARGUMENT_TYPE.STRING],
          isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
          name: 'data',
          description: 'Data to be transferred',
          typeList: [ARGUMENT_TYPE.STRING],
          isRequired: false,
          acceptsMultiple: true,
        }),
      ],
      unnamedArgumentList: [],
      helpString: `
    <div>
        Send \`event\` with optional data.
        All listeners registered for this event will automatically run and receive the data.
        Due to STScript input limitations, all data will be received as strings; convert to numbers etc. as needed.
    </div>
    <div>
        <strong>Example:</strong>
        <ul>
            <li>
                <pre><code class="language-stscript">/event-emit event="Read file"</code></pre>
            </li>
            <li>
                <pre><code class="language-stscript">/event-emit event="Archive" data={{getvar::data}} data=8 data=Hello {{user}}</code></pre>
            </li>
            <li>
                <pre><code class="language-stscript">/event-emit event="Any name" data="This is a data" data={{user}}</code></pre>
            </li>
        </ul>
    </div>
  `,
    }),
  );
}
