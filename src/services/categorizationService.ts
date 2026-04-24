import { CATEGORIES } from '../constants';

export function suggestCategory(url: string, title: string = ''): string {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();

    // 1. Development
    if (
      host.includes('github') || 
      host.includes('stackoverflow') || 
      host.includes('gitlab') || 
      host.includes('bitbucket') ||
      host.includes('npm') ||
      host.includes('developer.') ||
      host.includes('docker') ||
      host.includes('digitalocean') ||
      host.includes('aws.') ||
      host.includes('google.cloud') ||
      host.includes('vercel') ||
      host.includes('netlify') ||
      titleLower.includes('documentation') ||
      titleLower.includes('api') ||
      titleLower.includes('github')
    ) {
      return 'Development';
    }

    // 2. Design
    if (
      host.includes('figma') || 
      host.includes('behanace') || 
      host.includes('dribbble') || 
      host.includes('canva') ||
      host.includes('pinterest') ||
      host.includes('unsplash') ||
      host.includes('adobe') ||
      titleLower.includes('design') ||
      titleLower.includes('ux') ||
      titleLower.includes('ui') ||
      titleLower.includes('font') ||
      titleLower.includes('icon') ||
      titleLower.includes('palette')
    ) {
      return 'Design';
    }

    // 3. Reading List
    if (
      host.includes('medium.com') || 
      host.includes('substack') || 
      host.includes('pocket') || 
      host.includes('instapaper') ||
      host.includes('blog.') ||
      host.includes('nytimes.com') ||
      host.includes('theverge.com') ||
      host.includes('techcrunch') ||
      titleLower.includes('article') ||
      titleLower.includes('story') ||
      titleLower.includes('read')
    ) {
      return 'Reading List';
    }

    // 4. Tools
    if (
      host.includes('tool') || 
      host.includes('app.') || 
      host.includes('calc') || 
      host.includes('convert') ||
      host.includes('generator') ||
      host.includes('editor') ||
      host.includes('trello') ||
      host.includes('linear.app')
    ) {
      return 'Tool';
    }

    // 5. Resources (Educational / Assets)
    if (
      host.includes('wikipedia') || 
      host.includes('docs.') || 
      host.includes('resource') || 
      host.includes('learn') ||
      host.includes('course') ||
      host.includes('tutorial') ||
      host.includes('freecodecamp') ||
      host.includes('coursera') ||
      host.includes('udemy')
    ) {
      return 'Resource';
    }

  } catch (e) {
    // If URL is invalid, fallback to title checks
  }

  return 'General';
}
