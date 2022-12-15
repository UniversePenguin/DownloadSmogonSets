const puppeteer = require('puppeteer');
const fs = require('fs');

const allPokemonNames = fs.readFileSync('allPokemon.txt', 'utf8').split('\r\n').map(value => value.toLowerCase());

//start();

//jsonToPKMFiles();

fixPKMFiles();

async function start() {

    let allSets = [];
    
    for (let i = 0; i < allPokemonNames.length; i++) {

        let thisPokemonSets = await getOUSMSets(allPokemonNames[i]);

        if (thisPokemonSets != null) {

            for (let j = 0; j < thisPokemonSets.length; j++) {

                allSets.push(thisPokemonSets[j]);

            }

        }

    }

    fs.writeFileSync('output.json', JSON.stringify(allSets, null, 4));

}

async function getOUSMSets(inputPokemon) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto(`https://www.smogon.com/dex/ss/pokemon/${inputPokemon}/ou/`);

    let doesItExist = false;

    await page.waitForSelector('div.PokemonPage-StrategySelector', {
        timeout: 200
    }).catch((reason) => {
        console.log(`${inputPokemon} has no tiers lmao`);

        doesItExist = true;
    })

    if (doesItExist) {
        await browser.close();

        return null;
    }

    let stratSelector = await page.$$('div.PokemonPage-StrategySelector');

    let selectedTier = await stratSelector[0].$('span.is-selected');

    let tierText = await (await selectedTier.getProperty('textContent')).jsonValue();

    if (!(tierText == 'OU')) {
        
        await browser.close();

        console.log(`${inputPokemon} not OU`);

        return null;

    }

    let allInfo = [];

    let movesetBlocks = await page.$$('div.BlockMovesetInfo');

    for(let i = 0; i < movesetBlocks.length; i++) {

        let thisBlock = movesetBlocks[i];

        let moves = await thisBlock.$$('ul.MoveList');

        let moveTextArray = [];

        for (let j = 0; j < moves.length; j++) {

            let thisMove = await moves[j].$eval('li', a => a.getAttribute('data-reactid'));

            moveTextArray.push(thisMove.split('$')[1]);

        }

        allInfo.push(moveTextArray);

    }

    let otherInfoBlock = await page.$$('div.MovesetInfo-misc');

    for (let i = 0; i < otherInfoBlock.length; i++) {

        let thisItem = await otherInfoBlock[i].$('ul.ItemList');

        thisItem = await thisItem.$eval('li', a => a.getAttribute('data-reactid'));

        let thisAbility = await otherInfoBlock[i].$('ul.AbilityList');

        thisAbility = await thisAbility.$eval('li', a => a.getAttribute('data-reactid'));

        let thisNature = await otherInfoBlock[i].$('ul.NatureList');

        thisNature = await thisNature.$eval('abbr', a => a.textContent);

        let theseEVs = await otherInfoBlock[i].$$('td');

        theseEVs = theseEVs[3];

        theseEVs = await theseEVs.$$('li');

        let thisEVArray = [];

        for (let j = 0; j < theseEVs.length; j++) {

            let thisEV = await (await theseEVs[j].getProperty('textContent')).jsonValue();

            thisEVArray.push(thisEV);

        }

        allInfo.push([
            thisItem.split('$')[1], thisAbility.split('$')[1], thisNature, thisEVArray
        ]);

    }

    await browser.close();

    console.log(`Downloaded ${inputPokemon}'s OU set`);

    return stichArray(allInfo, inputPokemon);
}

function stichArray(inputArray, pokemonName) {

    let halfArrayLength = Math.floor(inputArray.length/2);

    let toReturn = [];

    for (let i = 0; i < halfArrayLength; i++) {
        let moves = inputArray[i];
        let otherInfo = inputArray[i + halfArrayLength];

        toReturn.push({
            pkmnName: pokemonName,
            moves: moves,
            item: otherInfo[0],
            ability: otherInfo[1],
            nature: otherInfo[2],
            EVs: otherInfo[3]
        })

    }

    return toReturn;

}

function jsonToPKMFiles() {

    let jsonFile = JSON.parse(fs.readFileSync('output.json', 'utf8'));

    for (let i = 0; i < jsonFile.length; i++) {

        let thisPokemon = jsonFile[i];

        let newFile = `${thisPokemon.pkmnName} @ ${thisPokemon.item}\n`

        newFile += `Ability: ${thisPokemon.ability}\n`

        newFile += `EVs: `;

        for (let j = 0; j < thisPokemon.EVs.length; j++) {

            if (j < thisPokemon.EVs.length - 1) {

                newFile += `${thisPokemon.EVs[j]} / `;

            } else {

                newFile += `${thisPokemon.EVs[j]}\n`

            }

        }

        newFile += `${thisPokemon.nature} Nature\n`;

        for (let j = 0; j < thisPokemon.moves.length; j++) {

            newFile += `- ${thisPokemon.moves[j]}\n`

        }

        let counter = 1;
        while (true) {

            if (!(fs.existsSync(`outputFiles\\${thisPokemon.pkmnName}${counter}.pkm`))) {
                fs.writeFileSync(`outputFiles\\${thisPokemon.pkmnName}${counter}.pkm`, newFile);
                break;
            }

            counter++;

        }

    }

}

function fixPKMFiles() {

    let previousSets = [];

    fs.readdir('outputFiles', (err, files) => {

        files = files.filter(fileName => fileName.split('.')[1] == 'pkm');

        for (file of files) {

            let setData = fs.readFileSync(`outputFiles/${file}`, 'utf8');

            if (!(previousSets.includes(setData))){

                previousSets.push(setData);

                let nameSplit = setData.split(' @ ');

                let newName = fixNameCapitalization(nameSplit[0]);

                setData = newName + ' @ ' + nameSplit[1];

                let lineByLine = setData.split('\n');
            
                for (index in lineByLine) {

                    if (lineByLine[index].includes('Hidden Power')) {

                        lineByLine[index] = fixHiddenPower(lineByLine[index]);

                    }

                }

                let newFile = lineByLine.join('\n');

                let counter = 1;
                while (true) {

                    if (!(fs.existsSync(`newSets\\${newName}${counter}.pkm`))) {
                        fs.writeFileSync(`newSets\\${newName}${counter}.pkm`, newFile);
                        break;
                    }

                    counter++;

                }
                
            }

        }

    })

}

function fixNameCapitalization(inputName) {

    let toReturn = '';

    let letterArray = inputName.split('');

    let i = 0;
    while (i < letterArray.length) {

        if (i == 0) {
            toReturn += letterArray[i].toUpperCase();
        } else if (letterArray[i] == '-') {
            toReturn += `-${letterArray[i + 1].toUpperCase()}`;
            i++;
        } else {
            toReturn += letterArray[i];
        }
        i++;

    }

    return toReturn.substring(0);

}

function fixHiddenPower(inputString) {

    let splitString = inputString.split(' ');

    let toReturn = '';

    for (let i = 0; i < splitString.length; i++) {

        if (!(i == 3)) {

            toReturn += splitString[i] + ' ';

        } else {
            toReturn += `[${splitString[i]}]`
        }

    }

    return toReturn;

}