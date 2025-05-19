//------------------------------------------------------------------------------------------------------------------------
// Deprecated interfaces - please update them as indicated

/** @deprecated This function was created before event listeners were available. Now please use `insertOrAssignVariables` with event listeners or conditional logic to control updates */
async function setVariables(
  message_id: number | Record<string, any>,
  new_or_updated_variables?: Record<string, any>,
): Promise<void> {
  let actual_message_id: number;
  let actual_variables: Record<string, any>;
  if (new_or_updated_variables) {
    actual_message_id = message_id as number;
    actual_variables = new_or_updated_variables as Record<string, any>;
  } else {
    actual_message_id = getCurrentMessageId();
    actual_variables = message_id as Record<string, any>;
  }
  if (typeof actual_message_id !== 'number' || typeof actual_variables !== 'object') {
    console.error('[Variables][setVariables] Call failed - please check your parameter types');
    return;
  }
  return detail.make_iframe_promise({
    request: '[Variables][setVariables]',
    message_id: actual_message_id,
    variables: actual_variables,
  });
}
