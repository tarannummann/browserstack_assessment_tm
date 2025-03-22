"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const selenium_webdriver_1 = require("selenium-webdriver");
const chrome = __importStar(require("selenium-webdriver/chrome"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const request_1 = __importDefault(require("request"));
const google_translate_api_1 = require("@vitalets/google-translate-api");
const OUTPUT_DIR = path.join(__dirname, '../article_images');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}
// Function to download image
function Image_download(url, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, request_1.default)(url)
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
    });
}
function scrapeOpinionArticles(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        yield driver.get('https://elpais.com/opinion/');
        yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.className('c_h')), 10000);
        const articleData = [];
        for (let i = 0; i < 5; i++) {
            const articles = yield driver.findElements(selenium_webdriver_1.By.css('header.c_h, .c_h, header[class*="c_h"]'));
            if (i >= articles.length)
                break; // If fewer than 5 articles are present
            const article = articles[i];
            const title = yield article.findElement(selenium_webdriver_1.By.className('c_t')).getText();
            const h2Element = yield article.findElement(selenium_webdriver_1.By.css('h2.c_t'));
            const linkElement = yield h2Element.findElement(selenium_webdriver_1.By.css('a'));
            const articleLink = yield linkElement.getAttribute('href');
            yield driver.get(articleLink);
            // Fetch content
            let content;
            try {
                content = yield driver.findElement(selenium_webdriver_1.By.className('article_body')).getText();
            }
            catch (_a) {
                content = 'No summary available';
            }
            // Fetch the image
            let image;
            try {
                const divElement = yield driver.findElement(selenium_webdriver_1.By.className('a_e_m'));
                const imgElement = yield divElement.findElement(selenium_webdriver_1.By.tagName('img'));
                const imgUrl = yield imgElement.getAttribute('src');
                image = path.join(OUTPUT_DIR, `article_${i + 1}.jpg`);
                yield Image_download(imgUrl, image);
            }
            catch (_b) {
                console.log(`No image found for article ${i + 1}`);
            }
            articleData.push({ title, content, image });
            // Returning to the main opinion page for accesing other articles
            yield driver.get('https://elpais.com/opinion/');
            yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.className('c_t')), 10000);
        }
        return articleData;
    });
}
// Function to translate titles
function translateTitles(article_Data) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const article of article_Data) {
            const translated = yield (0, google_translate_api_1.translate)(article.title, { from: 'es', to: 'en' });
            article.titleEn = translated.text;
        }
        return article_Data;
    });
}
// Function to analyze repeated words
function analyzeRepeatedWords(articleData) {
    const allTitles = articleData.map(a => { var _a; return (_a = a.titleEn) === null || _a === void 0 ? void 0 : _a.toLowerCase(); }).join(' ');
    const words = allTitles.match(/\b\w+\b/g) || [];
    const wordCount = new Map();
    words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    const repeatedWords = new Map();
    wordCount.forEach((count, word) => {
        if (count > 2)
            repeatedWords.set(word, count);
    });
    return repeatedWords;
}
// Local execution of code
function runLocally() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = new chrome.Options();
        const driver = yield new selenium_webdriver_1.Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
        try {
            console.log('Scraping articles...');
            const articleData = yield scrapeOpinionArticles(driver);
            console.log('------------\nArticles in Spanish:-----------------------');
            yield articleData.forEach((article, i) => {
                console.log(`Article ${i + 1}:`);
                console.log(`Title: ${article.title}`);
                console.log(`Content: ${article.content}`);
                console.log(`Image: ${article.image || 'No image found'}`);
                console.log('-'.repeat(50));
            });
            console.log('-----------------\nTranslating titles...-------------------');
            const translatedArticles = yield translateTitles(articleData);
            console.log('-------------\nTranslated Titles in English:--------------------');
            yield translatedArticles.forEach((article, i) => {
                console.log(`Article ${i + 1}: ${article.titleEn}`);
            });
            console.log('--------------------\nAnalyzing repeated words...----------------');
            const repeatedWords = analyzeRepeatedWords(translatedArticles);
            if (repeatedWords.size > 0) {
                console.log('Words repeated more than twice:');
                repeatedWords.forEach((count, word) => console.log(`${word}: ${count}`));
            }
            else {
                console.log('No words repeated more than twice');
            }
        }
        finally {
            yield driver.quit();
        }
    });
}
// BrowserStack execution
function runOnBrowserStack() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(" Starting BrowserStack ");
        const BROWSERSTACK_USERNAME = 'tarannumchaudhar_xiqwfA';
        const BROWSERSTACK_ACCESS_KEY = 'ijPVasYCniZ1swks6Dgr';
        const BROWSERSTACK_URL = `https://${BROWSERSTACK_USERNAME}:${BROWSERSTACK_ACCESS_KEY}@hub-cloud.browserstack.com/wd/hub`;
        console.log('BROWSERSTACK_URL', BROWSERSTACK_URL);
        const capabilities = [
            { browserName: 'Chrome', platform: 'WINDOWS', browserVersion: 'latest' },
            { browserName: 'Firefox', platform: 'WINDOWS', browserVersion: 'latest' },
            { browserName: 'Safari', platform: 'MAC', browserVersion: 'latest' },
            { browserName: 'Chrome', platform: 'ANDROID', device: 'Samsung Galaxy S22' },
            { browserName: 'Safari', platform: 'IOS', device: 'iPhone 14' },
        ];
        const promises = capabilities.map((caps) => __awaiter(this, void 0, void 0, function* () {
            caps['browserstack.local'] = false;
            const driver = yield new selenium_webdriver_1.Builder()
                .usingServer(BROWSERSTACK_URL)
                .withCapabilities(caps)
                .build();
            try {
                console.log(`Running on ${caps.browserName} - ${caps.device || caps.platform}`);
                const articleData = yield scrapeOpinionArticles(driver);
                console.log(`Scraped ${articleData.length} articles ` + caps.platform);
            }
            finally {
                yield driver.quit();
            }
        }));
        yield Promise.all(promises);
    });
}
// Main execution
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running code locally');
    yield runLocally();
    console.log('\nRunning code on BrowserStack...');
    yield runOnBrowserStack();
}))();
