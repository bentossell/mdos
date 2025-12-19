import { spawn } from 'child_process';
import { resolve } from 'path';

/**
 * Execute a CLI command and return result
 */
export function executeCommand(command, tools = {}, cwd = process.cwd()) {
  return new Promise((resolvePromise, reject) => {
    // Parse command - handle tool substitution
    let cmd = command;
    
    // Replace tool references: [toolname] args -> /path/to/tool args
    for (const [toolName, toolPath] of Object.entries(tools)) {
      const pattern = new RegExp(`\\[${toolName}\\]`, 'g');
      cmd = cmd.replace(pattern, toolPath);
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
      env: process.env
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
export async function executeWidgets(widgets, tools = {}, cwd = process.cwd()) {
  const results = {};
  
  for (const [name, command] of Object.entries(widgets)) {
    try {
      const result = await executeCommand(command, tools, cwd);
      results[name] = result.success ? result.stdout : `Error: ${result.error}`;
    } catch (error) {
      results[name] = `Error: ${error.message}`;
    }
  }
  
  return results;
}

/**
 * Execute an action and return result
 */
export async function executeAction(actionName, actions, tools = {}, cwd = process.cwd()) {
  const command = actions[actionName];
  
  if (!command) {
    return {
      success: false,
      error: `Action '${actionName}' not found`
    };
  }
  
  try {
    return await executeCommand(command, tools, cwd);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
