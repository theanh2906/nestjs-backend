#!/usr/bin/env node

// web-crawler.js
'use strict';

const minimist = require('minimist');
const { chromium, firefox, webkit } = require('playwright');
const cheerio = require('cheerio');
const argv = minimist(process.argv.slice(2));
const baseUrl = argv.url || argv.u || '';
const start = argv.start || argv.s || 0;
const end = argv.end || argv.e || 10;
const outputFile = argv.out || argv.o || 'output.json';
const browserType = argv.browser || argv.b || 'chromium';

const showHelp = () => {
  console.log(
    'Usage: node web-crawler.js --url <base_url> --start <start_index> --end <end_index> --browser <browser_type>'
  );
  console.log(
    'Example: node web-crawler.js --url https://example.com --start 0 --end 10 --browser chromium'
  );
  console.log('Available browsers: chromium (default), firefox, webkit');
};

const getBrowser = async (type) => {
  switch (type) {
    case 'firefox':
      return await firefox.launch();
    case 'webkit':
      return await webkit.launch();
    case 'chromium':
    default:
      return await chromium.launch();
  }
};

const crawl = async (url, start, end) => {
  const browser = await getBrowser(browserType);
  const context = await browser.newContext();
  const page = await context.newPage();
  const detailPage = await context.newPage();
  const data = [];

  for (let i = start; i <= end; i++) {
    await page.goto(url.replace('{page}', i), {
      waitUntil: 'networkidle',
      timeout: 100000, // 100 seconds timeout
    });
    const content = await page.content();
    const $ = cheerio.load(content);
    // Doctor name
    $('.info_chuyengia').each(async (index, element) => {
      const name = $(element).find('h2').text();
      const position = $(element)
        .find('.font_helI')
        .contents()
        .filter(function () {
          return this.nodeType === 3;
        })
        .text()
        .trim();
      data.push({
        name,
        position,
        page: i,
      });
    });
    // Doctor image
    $('.thumb_cgia').each(async (index, element) => {
      const detailUrl = $(element).attr('href');
      const imgSrc = $(element).find('img').attr('src');
      const mappingName = $(element).find('img').attr('alt');
      data.filter((item) => item.name === mappingName)[0].img_src = imgSrc;
      await crawlEachPage(detailPage, context, detailUrl);
    });
  }

  console.log(data);

  await browser.close();
  return data;
};

const crawlEachPage = async (page, context, detailUrl) => {
  if (detailUrl) {
    await page.goto(detailUrl, {
      waitUntil: 'networkidle',
      timeout: 100000, // 100 seconds timeout
    });
    const content = await page.content();
    const $ = cheerio.load(content);
    console.log($('#collapsekinhnghiemct'));
    $('#collapsekinhnghiemct').each((index, element) => {
      const experience = $(element)
        .find('ul')
        .contents()
        .map(() => this.text());
      console.log($(element).find('ul').contents());
    });
    return doctorDetails;
  }
};

const main = async () => {
  if (argv.help || argv.h) {
    showHelp();
    process.exit(0);
  }

  if (!baseUrl) {
    console.error('Error: URL is required');
    showHelp();
    process.exit(1);
  }

  try {
    // Start timing the crawling process
    const startTime = new Date();

    const doctorData = await crawl(baseUrl, start, end);
    writeToFile(doctorData);

    // Calculate and display total crawling time
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    console.log(`Total crawling time: ${totalTime.toFixed(2)} seconds`);

    process.exit(0);
  } catch (error) {
    console.error('Error during crawling:', error);
    process.exit(1);
  }
};

const writeToFile = (data) => {
  const fs = require('fs');
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');
};

main();
