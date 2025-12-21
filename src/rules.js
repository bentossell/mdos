import { readFileSync, existsSync } from 'fs';

/**
 * Rule parser - parses markdown rule files into structured format
 */
export class RuleParser {
  /**
   * Parse a rule file
   */
  parse(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Rule file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf8');
    const rules = [];
    
    // Split into rule sections (## headers)
    const sections = this.splitSections(content);
    
    for (const section of sections) {
      const rule = this.parseSection(section);
      if (rule) {
        rules.push(rule);
      }
    }

    return rules;
  }

  /**
   * Split content into sections by ## headers
   */
  splitSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = [];
    
    for (const line of lines) {
      if (line.startsWith('## ') && currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
        currentSection = [line];
      } else {
        currentSection.push(line);
      }
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    return sections;
  }

  /**
   * Parse a single rule section
   */
  parseSection(content) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    // Extract rule name from header
    const headerMatch = lines[0].match(/^## (.+)$/);
    if (!headerMatch) return null;

    const name = headerMatch[1].trim();
    const rule = {
      name,
      conditions: [],
      action: null,
      approval: 'queue', // Default to queue
      priority: 0
    };

    let inConditions = false;
    let inAction = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('Conditions:')) {
        inConditions = true;
        inAction = false;
        continue;
      }
      
      if (line.startsWith('Action:')) {
        inConditions = false;
        inAction = true;
        const actionMatch = line.match(/^Action:\s*(.+)$/);
        if (actionMatch) {
          rule.action = actionMatch[1].trim();
        }
        continue;
      }
      
      if (line.startsWith('Approval:')) {
        const approvalMatch = line.match(/^Approval:\s*(.+)$/);
        if (approvalMatch) {
          rule.approval = approvalMatch[1].trim();
        }
        continue;
      }

      if (line.startsWith('Priority:')) {
        const priorityMatch = line.match(/^Priority:\s*(\d+)$/);
        if (priorityMatch) {
          rule.priority = parseInt(priorityMatch[1], 10);
        }
        continue;
      }
      
      // Parse condition lines (start with -)
      if (inConditions && line.startsWith('-')) {
        const condition = this.parseCondition(line.slice(1).trim());
        if (condition) {
          rule.conditions.push(condition);
        }
      }
    }

    return rule.action ? rule : null;
  }

  /**
   * Parse a single condition line
   */
  parseCondition(line) {
    // Format: "field operator value"
    // Examples:
    // - sender contains "newsletter"
    // - subject contains "urgent" or "asap"
    // - sender domain in [marketing.*, promo.*]
    // - age > 24h
    
    // Handle "or" conditions
    if (line.includes(' or ')) {
      const parts = line.split(' or ').map(p => p.trim());
      return {
        type: 'or',
        conditions: parts.map(p => this.parseSimpleCondition(p))
      };
    }

    return this.parseSimpleCondition(line);
  }

  /**
   * Parse a simple condition (no or)
   */
  parseSimpleCondition(line) {
    // Contains
    let match = line.match(/^(.+?)\s+contains\s+"([^"]+)"$/);
    if (match) {
      return {
        type: 'contains',
        field: match[1].trim(),
        value: match[2]
      };
    }

    // Domain match
    match = line.match(/^(.+?)\s+domain\s+in\s+\[(.+)\]$/);
    if (match) {
      const domains = match[2].split(',').map(d => d.trim());
      return {
        type: 'domain',
        field: match[1].trim(),
        values: domains
      };
    }

    // In list
    match = line.match(/^(.+?)\s+in\s+\[(.+)\]$/);
    if (match) {
      const values = match[2].split(',').map(v => v.trim().replace(/['"]/g, ''));
      return {
        type: 'in',
        field: match[1].trim(),
        values
      };
    }

    // Comparison
    match = line.match(/^(.+?)\s+([<>=]+)\s+(.+)$/);
    if (match) {
      return {
        type: 'compare',
        field: match[1].trim(),
        operator: match[2],
        value: match[3].trim()
      };
    }

    // Fallback: treat as contains
    return {
      type: 'contains',
      field: 'any',
      value: line
    };
  }
}

/**
 * Rule evaluator - checks if rules match given data
 */
export class RuleEvaluator {
  /**
   * Evaluate a rule against data
   */
  evaluate(rule, data) {
    // Check all conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, data)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, data) {
    if (condition.type === 'or') {
      return condition.conditions.some(c => this.evaluateCondition(c, data));
    }

    const fieldValue = this.getFieldValue(condition.field, data);
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    switch (condition.type) {
      case 'contains':
        return String(fieldValue).toLowerCase().includes(condition.value.toLowerCase());
      
      case 'domain':
        const domain = this.extractDomain(fieldValue);
        return condition.values.some(pattern => this.matchDomain(domain, pattern));
      
      case 'in':
        return condition.values.includes(String(fieldValue));
      
      case 'compare':
        return this.compare(fieldValue, condition.operator, condition.value);
      
      default:
        return false;
    }
  }

  /**
   * Get field value from data object
   */
  getFieldValue(field, data) {
    // Support nested fields with dot notation
    const parts = field.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return null;
      }
    }
    
    return value;
  }

  /**
   * Extract domain from email address
   */
  extractDomain(email) {
    const match = String(email).match(/@(.+)$/);
    return match ? match[1] : email;
  }

  /**
   * Match domain against pattern (supports wildcards)
   */
  matchDomain(domain, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(domain);
    }
    return domain === pattern;
  }

  /**
   * Compare values
   */
  compare(value, operator, target) {
    switch (operator) {
      case '=':
      case '==':
        return value == target;
      case '>':
        return value > target;
      case '<':
        return value < target;
      case '>=':
        return value >= target;
      case '<=':
        return value <= target;
      case '!=':
        return value != target;
      default:
        return false;
    }
  }
}
