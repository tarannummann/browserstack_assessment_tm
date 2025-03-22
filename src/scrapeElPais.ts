import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as fs from 'fs';
import * as path from 'path';
import request from 'request';
import { translate } from '@vitalets/google-translate-api';
import { platform } from 'os';

// Interfaces for article data
interface Article {
  title: string;
  content: string;
  image?: string;
  titleEn?: string;
}

// Interface for BrowserStack capabilities
interface BrowserStackCapabilities {
  browserName: string;
  platform: string;
  browserVersion?: string;
  device?: string;
  'browserstack.local'?: boolean;
  [key: string]: any; // Allow additional BrowserStack properties
}

const OUTPUT_DIR = path.join(__dirname, '../article_images');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// Function to download image
async function Image_download(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    request(url)
      .pipe(fs.createWriteStream(filename))
      .on('close', () => {
        console.log(`Image saved: ${filename}`);
        resolve();
      })
      .on('error', (err) => {
        console.log(`Error downloading image: ${err.message}`);
        reject(err);
      });
  });
}

async function scrapeOpinionArticles(driver: WebDriver): Promise<Article[]> {
    await driver.get('https://elpais.com/opinion/');
    await driver.wait(until.elementLocated(By.className('c_h')), 10000);
  
    const articleData: Article[] = [];
  
    for (let i = 0; i < 5; i++) {
      const articles = await driver.findElements(By.css('header.c_h, .c_h, header[class*="c_h"]'));
  
      if (i >= articles.length) break;  // If fewer than 5 articles are present
  
      const article = articles[i];
      const title = await article.findElement(By.className('c_t')).getText();
      const h2Element = await article.findElement(By.css('h2.c_t'));
      const linkElement = await h2Element.findElement(By.css('a'));
      const articleLink = await linkElement.getAttribute('href');
      await driver.get(articleLink);
  
      // Fetch content
      let content: string;
      try {
        content = await driver.findElement(By.className('article_body')).getText();
      } catch {
        content = 'No summary available';
      }
  
      // Fetch the image
      let image: string | undefined;
      try {
        const divElement = await driver.findElement(By.className('a_e_m'));
        const imgElement = await divElement.findElement(By.tagName('img'));
        const imgUrl = await imgElement.getAttribute('src');
        image = path.join(OUTPUT_DIR, `article_${i + 1}.jpg`);
        await Image_download(imgUrl, image);
      } catch {
        console.log(`No image found for article ${i + 1}`);
      }
  
      articleData.push({ title, content, image });
  
      // Returning to the main opinion page for accesing other articles
      await driver.get('https://elpais.com/opinion/');
      await driver.wait(until.elementLocated(By.className('c_t')), 10000); 
    }
  
    return articleData;
  } 

// Function to translate titles
async function translateTitles(article_Data: Article[]): Promise<Article[]> {
  for (const article of article_Data) {
    const translated = await translate(article.title, { from: 'es', to: 'en' });
    article.titleEn = translated.text;
  }
  return article_Data;
}
// Function to analyze repeated words
function analyzeRepeatedWords(articleData: Article[]): Map<string, number> {
  const allTitles = articleData.map(a => a.titleEn?.toLowerCase()).join(' ');
  const words = allTitles.match(/\b\w+\b/g) || [];
  const wordCount = new Map<string, number>();

  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  const repeatedWords = new Map<string, number>();
  wordCount.forEach((count, word) => {
    if (count > 2) repeatedWords.set(word, count);
  });

  return repeatedWords;
}

// Local execution of code

async function runLocally(): Promise<void> {
  const options = new chrome.Options();
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log('Scraping articles...');
    const articleData = await scrapeOpinionArticles(driver);

    console.log('------------\nArticles in Spanish:-----------------------');
    await articleData.forEach((article, i) => {
      console.log(`Article ${i + 1}:`);
      console.log(`Title: ${article.title}`);
      console.log(`Content: ${article.content}`);
      console.log(`Image: ${article.image || 'No image found'}`);
      console.log('-'.repeat(50));
    });

    console.log('-----------------\nTranslating titles...-------------------');
    const translatedArticles = await translateTitles(articleData);

    console.log('-------------\nTranslated Titles in English:--------------------');
    await translatedArticles.forEach((article, i) => {
      console.log(`Article ${i + 1}: ${article.titleEn}`);
    });

    console.log('--------------------\nAnalyzing repeated words...----------------');
    const repeatedWords = analyzeRepeatedWords(translatedArticles);
    if (repeatedWords.size > 0) {
      console.log('Words repeated more than twice:');
      repeatedWords.forEach((count, word) => console.log(`${word}: ${count}`));
    } else {
      console.log('No words repeated more than twice');
    }
  } finally {
    await driver.quit();
  }
}

// BrowserStack execution

async function runOnBrowserStack(): Promise<void> {
  console.log(" Starting BrowserStack ")
  const BROWSERSTACK_USERNAME = 'tarannumchaudhar_xiqwfA';
  const BROWSERSTACK_ACCESS_KEY = 'ijPVasYCniZ1swks6Dgr';
  const BROWSERSTACK_URL = `https://${BROWSERSTACK_USERNAME}:${BROWSERSTACK_ACCESS_KEY}@hub-cloud.browserstack.com/wd/hub`;
 console.log('BROWSERSTACK_URL', BROWSERSTACK_URL);
  const capabilities: BrowserStackCapabilities[] = [
    { browserName: 'Chrome', platform: 'WINDOWS', browserVersion: 'latest' },
    { browserName: 'Firefox', platform: 'WINDOWS', browserVersion: 'latest' },
    { browserName: 'Safari', platform: 'MAC', browserVersion: 'latest' },
    { browserName: 'Chrome', platform: 'ANDROID', device: 'Samsung Galaxy S22' },
    { browserName: 'Safari', platform: 'IOS', device: 'iPhone 14' },
  ];

  const promises = capabilities.map(async (caps) => {
    caps['browserstack.local'] = false;
    const driver = await new Builder()
      .usingServer(BROWSERSTACK_URL)
      .withCapabilities(caps)
      .build();

    try {
      console.log(`Running on ${caps.browserName} - ${caps.device || caps.platform}`);
      const articleData = await scrapeOpinionArticles(driver);
      console.log(`Scraped ${articleData.length} articles `+ caps.platform);
    } finally {
      await driver.quit();
    }
  });

  await Promise.all(promises);
}

// Main execution
(async () => {
  console.log('Running code locally');
  await runLocally();

  console.log('\nRunning code on BrowserStack...');
  await runOnBrowserStack();
})
();