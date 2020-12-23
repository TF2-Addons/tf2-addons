const rconManager = require('./rconManager');
const tf2Paths = require('./tf2Paths');
const path = require('path');
const fs = require('fs').promises;
const awaitTimeout = require('./awaitTimeout');

// From https://github.com/PazerOP/tf2_bot_detector/blob/master/tf2_bot_detector/Config/ChatWrappers.cpp
const invisibleChars = ['\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'];

async function getLanguage()
{
    const langOutput = await rconManager.send('cl_language');
    const languageMatch = /"cl_language" = "(.+?)"/g.exec(langOutput);
    if(!languageMatch)
    {
        throw new Error(`Language not found! Output: "${langOutput}"`);
    }
    return languageMatch[1];
}

function getInvisibleSequence(length, others)
{
    if(!others)
    {
        others = [];
    }
    let str;
    do
    {
        str = '';
        for(let i = 0; i < length; i++)
        {
            str += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
        }
    } while(others.indexOf(str) !== -1)
    return str;
}

function removeInvisibleSequence(line)
{
    for(const char of invisibleChars)
    {
        line = line.split(char).join('');
    }
    return line;
}

async function updateLocalizations()
{
    // Get the language and find the associated resource file
    const language = await getLanguage();
    const langPath = path.join(tf2Paths.resource, `tf_${language}.txt`);
    
    // Modify the resource file by loading it into ram, replacing parts, and writing it
    // If ram usage is a problem (files are about 5MB), a better solution could be reading from a stream and writing to a temp file
    let lines = (await fs.readFile(langPath, 'utf16le')).split('\n');
    
    const replacements = {
        'TF_Chat_Team_Loc': 'chat-team-loc',
        'TF_Chat_Team': 'chat-team',
        'TF_Chat_Team_Dead': 'chat-team-dead',
        'TF_Chat_Spec': 'chat-spec',
        'TF_Chat_All': 'chat-all',
        'TF_Chat_AllDead': 'chat-all-dead',
        'TF_Chat_AllSpec': 'chat-all-spec',
        'TF_Chat_Coach': 'chat-coach',
        'TF_Name_Change': 'name-change',
        'TF_Class_Change': 'class-change',
        'TF_Chat_Party': 'chat-party'
    };
    let generatedSequences = [];
    
    const nameStart = getInvisibleSequence(8, generatedSequences);
    generatedSequences.push(nameStart);
    const nameEnd = getInvisibleSequence(8, generatedSequences);
    generatedSequences.push(nameEnd);
    const messageStart = getInvisibleSequence(8, generatedSequences);
    generatedSequences.push(messageStart);
    const messageEnd = getInvisibleSequence(8, generatedSequences);
    generatedSequences.push(messageEnd);
    let results = {
        name: {
            start: nameStart,
            end: nameEnd
        },
        message: {
            start: messageStart,
            end: messageEnd
        },
        chat: []
    };
    
    for(let i = 0; i < lines.length; i++)
    {
        let found = false;
        let line = lines[i];
        for(const check in replacements)
        {
            // If this line is one of the text lines we'd like to replace
            if(line.startsWith(`"${check}"`))
            {
                line = removeInvisibleSequence(line);
                const value = /".+?"\s+"(.+?)"/g.exec(line)[1];
                
                const start = getInvisibleSequence(8, generatedSequences);
                generatedSequences.push(start);
                const end = getInvisibleSequence(8, generatedSequences);
                generatedSequences.push(end);
                
                // TF_Chat_Party has no fancy colors so we don't have to insert in the middle
                line = line.replace(value, (check !== 'TF_Chat_Party' ?
                        value[0] + start + value.substring(1) :
                        start + value)
                    + end)
                    .replace('%s1', nameStart + '%s1' + nameEnd)
                    .replace('%s2', messageStart + '%s2' + messageEnd);
                results.chat.push({
                    type: check,
                    start,
                    end
                });
                
                lines[i] = line;
                found = true;
                break;
            }
        }
        
        if(!found)
        {
            if(line.startsWith('"Game_connected"'))
            {
                line = removeInvisibleSequence(line);
                lines[i] = line.replace('%s1', nameStart + '%s1' + nameEnd);
                continue;
            }
            // add any other console lines with player input
        }
    }
    
    await fs.writeFile(langPath, Buffer.from('\ufeff' + lines.join('\n'), 'utf16le'), {encoding: 'utf16le'});
    
    // Ensure localization files get reloaded
    // Even with 5 seconds before reloading, they would occasionally not be reloaded
    await awaitTimeout(1000);
    await rconManager.send('cl_reload_localization_files');
    await awaitTimeout(1000);
    await rconManager.send('cl_reload_localization_files');
    
    return results;
}

module.exports = updateLocalizations;
