import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import * as handlebars from 'handlebars';

export type TemplateEngine = 'ejs' | 'handlebars' | 'kenx';

export interface ViewConfig {
  engine: TemplateEngine;
  viewsDir: string;
  layoutsDir?: string;
  partialsDir?: string;
  defaultLayout?: string;
  cache?: boolean;
}

export interface RenderOptions {
  layout?: string;
  partials?: { [name: string]: string };
  [key: string]: any;
}

export class KenxViews {
  private config: ViewConfig;
  private templateCache: Map<string, any> = new Map();
  private compiledCache: Map<string, Function> = new Map();

  constructor(config: ViewConfig) {
    this.config = {
      cache: process.env.NODE_ENV === 'production',
      ...config
    };

    this.setupHandlebarsHelpers();
  }
  // Render a template
  async render(templateName: string, data: any = {}, options: RenderOptions = {}): Promise<string> {
    try {
      const templatePath = this.resolveTemplatePath(templateName);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName} at ${templatePath}`);
      }

      let content: string;

      switch (this.config.engine) {
        case 'ejs':
          content = await this.renderEJS(templatePath, data, options);
          break;
        case 'handlebars':
          content = await this.renderHandlebars(templatePath, data, options);
          break;
        case 'kenx':
          content = await this.renderKenx(templatePath, data, options);
          break;
        default:
          throw new Error(`Unsupported template engine: ${this.config.engine}`);
      }      // Apply layout if specified
      if (options.layout || this.config.defaultLayout) {
        const layoutName = options.layout || this.config.defaultLayout!;
        const layoutPath = this.resolveLayoutPath(layoutName);
        
        if (fs.existsSync(layoutPath)) {
          const layoutData = { ...data, body: content };
          content = await this.renderTemplate(layoutPath, layoutData, { ...options, layout: undefined });
        }
      }

      return content;
    } catch (error) {
      console.error('Template render error:', error);
      throw error;
    }
  }

  // Render a template from a full file path
  private async renderTemplate(templatePath: string, data: any = {}, options: RenderOptions = {}): Promise<string> {
    try {
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
      }

      let content: string;

      switch (this.config.engine) {
        case 'ejs':
          content = await this.renderEJS(templatePath, data, options);
          break;
        case 'handlebars':
          content = await this.renderHandlebars(templatePath, data, options);
          break;
        case 'kenx':
          content = await this.renderKenx(templatePath, data, options);
          break;
        default:
          throw new Error(`Unsupported template engine: ${this.config.engine}`);
      }

      return content;
    } catch (error) {
      console.error('Template render error:', error);
      throw error;
    }
  }

  // EJS rendering
  private async renderEJS(templatePath: string, data: any, options: RenderOptions): Promise<string> {
    const cacheKey = `ejs:${templatePath}`;
    
    if (this.config.cache && this.templateCache.has(cacheKey)) {
      const template = this.templateCache.get(cacheKey);
      return ejs.render(template, data, { filename: templatePath });
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    
    if (this.config.cache) {
      this.templateCache.set(cacheKey, template);
    }

    return ejs.render(template, data, { filename: templatePath });
  }

  // Handlebars rendering
  private async renderHandlebars(templatePath: string, data: any, options: RenderOptions): Promise<string> {
    const cacheKey = `hbs:${templatePath}`;
    
    let compiledTemplate: HandlebarsTemplateDelegate;

    if (this.config.cache && this.compiledCache.has(cacheKey)) {
      compiledTemplate = this.compiledCache.get(cacheKey) as HandlebarsTemplateDelegate;
    } else {
      const template = fs.readFileSync(templatePath, 'utf8');
      compiledTemplate = handlebars.compile(template);
      
      if (this.config.cache) {
        this.compiledCache.set(cacheKey, compiledTemplate);
      }
    }    // Load partials
    this.loadPartials();

    return compiledTemplate(data);
  }

  // Custom Kenx template engine (simple but powerful)
  private async renderKenx(templatePath: string, data: any, options: RenderOptions): Promise<string> {
    const cacheKey = `kenx:${templatePath}`;
    
    if (this.config.cache && this.templateCache.has(cacheKey)) {
      const template = this.templateCache.get(cacheKey);
      return this.processKenxTemplate(template, data);
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    
    if (this.config.cache) {
      this.templateCache.set(cacheKey, template);
    }

    return this.processKenxTemplate(template, data);
  }
  // Process Kenx template syntax
  private processKenxTemplate(template: string, data: any): string {
    let result = template;

    // Replace variables: {{ variable }}
    result = result.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
      try {
        return this.evaluateExpression(expr.trim(), data) || '';
      } catch (error) {
        console.warn(`Template expression error: ${expr}`, error);
        return match;
      }
    });

    // Handle triple braces for unescaped content: {{{ variable }}}
    result = result.replace(/\{\{\{\s*([^}]+)\s*\}\}\}/g, (match, expr) => {
      try {
        return this.evaluateExpression(expr.trim(), data) || '';
      } catch (error) {
        console.warn(`Template expression error: ${expr}`, error);
        return match;
      }
    });

    // Process conditionals: {% if condition %} ... {% endif %}
    result = result.replace(/\{%\s*if\s+([^%]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (match, condition, content) => {
      try {
        if (this.evaluateExpression(condition.trim(), data)) {
          return this.processKenxTemplate(content, data);
        }
        return '';
      } catch (error) {
        console.warn(`Template condition error: ${condition}`, error);
        return match;
      }
    });

    // Process loops: {% for item in items %} ... {% endfor %}
    result = result.replace(/\{%\s*for\s+(\w+)\s+in\s+([^%]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g, (match, itemVar, arrayExpr, content) => {
      try {
        const array = this.evaluateExpression(arrayExpr.trim(), data);
        if (Array.isArray(array)) {
          return array.map((item, index) => {
            const loopData = { ...data, [itemVar]: item, index, first: index === 0, last: index === array.length - 1 };
            return this.processKenxTemplate(content, loopData);
          }).join('');
        }
        return '';
      } catch (error) {
        console.warn(`Template loop error: ${arrayExpr}`, error);
        return match;
      }
    });

    return result;
  }

  // Evaluate JavaScript expressions safely
  private evaluateExpression(expr: string, data: any): any {
    try {
      // Create a function that has access to the data
      const func = new Function('data', `with(data) { return ${expr}; }`);
      return func(data);
    } catch (error) {
      // Fallback to simple property access
      return this.getNestedProperty(data, expr);
    }
  }

  // Get nested property safely
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  // Load Handlebars partials
  private loadPartials(): void {
    if (!this.config.partialsDir || !fs.existsSync(this.config.partialsDir)) {
      return;
    }

    const partialFiles = fs.readdirSync(this.config.partialsDir)
      .filter(file => file.endsWith('.hbs') || file.endsWith('.handlebars'));

    for (const file of partialFiles) {
      const partialName = path.basename(file, path.extname(file));
      const partialPath = path.join(this.config.partialsDir, file);
      const partialContent = fs.readFileSync(partialPath, 'utf8');
      
      handlebars.registerPartial(partialName, partialContent);
    }
  }

  // Setup Handlebars helpers
  private setupHandlebarsHelpers(): void {
    // Date formatting helper
    handlebars.registerHelper('formatDate', (date: Date | string, format: string = 'YYYY-MM-DD') => {
      const d = new Date(date);
      return d.toLocaleDateString();
    });

    // JSON helper
    handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });

    // Conditional helpers
    handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    handlebars.registerHelper('gt', (a: any, b: any) => a > b);

    // String helpers
    handlebars.registerHelper('uppercase', (str: string) => str.toUpperCase());
    handlebars.registerHelper('lowercase', (str: string) => str.toLowerCase());
    handlebars.registerHelper('capitalize', (str: string) => 
      str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    );

    // Array helpers
    handlebars.registerHelper('length', (arr: any[]) => arr ? arr.length : 0);
    handlebars.registerHelper('first', (arr: any[]) => arr && arr[0]);
    handlebars.registerHelper('last', (arr: any[]) => arr && arr[arr.length - 1]);
  }

  // Utility methods
  private resolveTemplatePath(templateName: string): string {
    const ext = this.getTemplateExtension();
    const fileName = templateName.endsWith(ext) ? templateName : `${templateName}${ext}`;
    return path.join(this.config.viewsDir, fileName);
  }
  private resolveLayoutPath(layoutName: string): string {
    const layoutsDir = this.config.layoutsDir || path.join(this.config.viewsDir, 'layouts');
    const ext = this.getTemplateExtension();
    const fileName = layoutName.endsWith(ext) ? layoutName : `${layoutName}${ext}`;
    return path.join(layoutsDir, fileName);
  }

  private getTemplateExtension(): string {
    switch (this.config.engine) {
      case 'ejs':
        return '.ejs';
      case 'handlebars':
        return '.hbs';
      case 'kenx':
        return '.kenx';
      default:
        return '.html';
    }
  }

  // Clear caches
  clearCache(): void {
    this.templateCache.clear();
    this.compiledCache.clear();
  }
}

export default KenxViews;
