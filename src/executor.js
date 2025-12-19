import { spawn } from 'child_process';
import { resolve } from 'path';

/**
 * Execute a CLI command and return result
 */
export function executeCommand(command, tools = {}, cwd = process.cwd(), env = process.env) {
  return new Promise((resolvePromise, reject) => {
    // Parse command - handle tool substitution
    let cmd = command;
    
    // Replace tool references: [toolname] args -> /path/to/tool args
    for (const [toolName, toolPath] of Object.entries(tools)) {
      const pattern = new RegExp(`\\[${toolName}\\]`, 'g');
      cmd = cmd.replace(pattern, toolPath);
    }
    
    // Also replace bare tool names at start of command: toolname args -> /path/to/tool args
    const cmdParts = cmd.split(/\s+/);
    if (cmdParts.length > 0 && tools[cmdParts[0]]) {
      cmdParts[0] = tools[cmdParts[0]];
      cmd = cmdParts.join(' ');
    }
    
    // Split command into parts (simple split on spaces - could be improved)
    const parts = cmd.trim().split(/\s+/);
    const executable = parts[0];
    const args = parts.slice(1);
    
    let stdout = '';
    let stderr = '';
    
    const child = spawn(executable, args, {
      cwd,
      shell: true,
      env
    });
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code
        });
      } else {
        resolvePromise({
          success: false,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code,
          error: `Command exited with code ${code}`
        });
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute widget data fetches
 */
export async function executeWidgets(widgets, tools = {}, cwd = process.cwd(), env = process.env) {
  const results = {};
  
  for (const [name, command] of Object.entries(widgets)) {
    try {
      const result = await executeCommand(command, tools, cwd, env);
      results[name] = result.success ? result.stdout : `Error: ${result.error}`;
    } catch (error) {
      results[name] = `Error: ${error.message}`;
    }
  }
  
  return results;
}

/**
 * Execute an action and return result
 * Supports pattern-based actions with wildcards:
 *   [#archive-*]: !gmail archive $1  -> matches archive-ABC123, passes ABC123 as $1
 */
export async function executeAction(actionName, actions, tools = {}, cwd = process.cwd()) {
  // First try exact match
  let command = actions[actionName];
  let params = [];
  
  // If no exact match, try pattern matching
  if (!command) {
    for (const [pattern, cmd] of Object.entries(actions)) {
      // Convert pattern with * to regex
      if (pattern.includes('*')) {
        const regexStr = '^' + pattern.replace(/\*/g, '(.+)') + '$';
        const regex = new RegExp(regexStr);
        const match = actionName.match(regex);
        
        if (match) {
          command = cmd;
          params = match.slice(1); // captured groups
          break;
        }
      }
    }
  }
  
  if (!command) {
    return {
      success: false,
      error: `Action '${actionName}' not found`
    };
  }
  
  // Replace $1, $2, etc. with captured params
  let finalCommand = command;
  params.forEach((param, index) => {
    finalCommand = finalCommand.replace(new RegExp(`\\$${index + 1}`, 'g'), param);
  });
  
  try {
    return await executeCommand(finalCommand, tools, cwd);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
