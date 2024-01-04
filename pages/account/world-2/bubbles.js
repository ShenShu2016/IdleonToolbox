import {
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from 'components/common/context/AppProvider';
import styled from '@emotion/styled';
import { cleanUnderscore, growth, notateNumber, pascalCase, prefix } from 'utility/helpers';
import HtmlTooltip from 'components/Tooltip';
import debounce from 'lodash.debounce';
import { isArtifactAcquired } from '@parsers/sailing';
import { NextSeo } from 'next-seo';
import { getBubbleAtomCost, getBubbleBonus, getMaxCauldron, getVialsBonusByStat } from '@parsers/alchemy';
import Box from '@mui/material/Box';
import Tabber from '../../../components/common/Tabber';
import { CardTitleAndValue } from '@components/common/styles';
import InfoIcon from '@mui/icons-material/Info';

const Bubbles = () => {
  const { state } = useContext(AppContext);
  const [classDiscount, setClassDiscount] = useState(false);
  const [condenseView, setCondenseView] = useState(false);
  const [bargainTag, setBargainTag] = useState(0);
  const [effThreshold, setEffThreshold] = useState(75);
  const [selectedTab, setSelectedTab] = useState(0);
  const [bubbles, setBubbles] = useState();
  const [bubblesGoals, setBubblesGoals] = useState();
  const myFirstChemSet = useMemo(() => state?.account?.lab?.labBonuses?.find(bonus => bonus.name === 'My_1st_Chemistry_Set')?.active, [state?.account?.lab.vials]);

  useEffect(() => {
    const bubblesPage = Object.keys(state?.account?.alchemy?.bubbles)?.[selectedTab];
    setBubbles(state?.account?.alchemy?.bubbles?.[bubblesPage]);
  }, []);
  const handleOnClick = (selected) => {
    setSelectedTab(selected);
    const bubblesPage = Object.keys(state?.account?.alchemy?.bubbles)?.[selected];
    setBubbles(state?.account?.alchemy?.bubbles?.[bubblesPage]);
    if (selected === 3) {
      setClassDiscount(false);
    }
  }

  const handleBargainChange = (e) => {
    setBargainTag(e?.target?.value)
  }

  const handleGoalChange = debounce((e, cauldronName, index) => {
    const { value } = e.target;
    setBubblesGoals({
      ...bubblesGoals,
      [cauldronName]: {
        ...(bubblesGoals?.[cauldronName] || {}),
        [index]: !value ? 0 : parseInt(value)
      }
    });
  }, 100);

  const calcBubbleMatCost = (bubbleIndex, vialMultiplier = 1, bubbleLvl, baseCost, isLiquid, cauldronCostLvl,
                             undevelopedBubbleLv, barleyBrewLvl, lastBubbleLvl, classMultiplierLvl,
                             shopBargainBought, smrtAchievement, multiBubble) => {
    if (isLiquid) {
      return baseCost + Math.floor(bubbleLvl / 20);
    } else {
      const first = bubbleIndex < 15 ?
        baseCost * Math.pow(1.35 - (0.3 * bubbleLvl) / (50 + bubbleLvl), bubbleLvl) :
        baseCost * Math.pow(1.37 - (0.28 * bubbleLvl) / (60 + bubbleLvl), bubbleLvl);
      const cauldronCostReduxBoost = Math.max(0.1, 1 - ((Math.round(10 * growth('decay', cauldronCostLvl, 90, 100, false)) / 10)) / 100);
      const barleyBrewVialBonus = getVialsBonusByStat(state?.account?.alchemy?.vials, 'AlchBubbleCost');
      const undevelopedBubbleBonus = getBubbleBonus(state?.account?.alchemy?.bubbles, 'kazam', 'UNDEVELOPED_COSTS', false);
      const bubbleBargainBoost = Math.max(0.05, 1 - (growth('decay', lastBubbleLvl, 40, 12, false) / 100) *
        growth('decayMulti', classMultiplierLvl, 2, 50, false) *
        growth('decayMulti', multiBubble, 1.4, 30, false));
      const secondMath = Math.max(.05, 1 - (barleyBrewVialBonus + undevelopedBubbleBonus) / 100);
      const shopBargainBoost = Math.max(0.1, Math.pow(0.75, shopBargainBought));
      const smrtBoost = Math.max(.9, 1 - .1 * smrtAchievement)
      const endResult = first * bubbleBargainBoost * cauldronCostReduxBoost * secondMath * shopBargainBoost * smrtBoost;
      return Math.min(endResult, 1e9);
    }
  };

  const calculateMaterialCost = (bubbleLv, baseCost, isLiquid, cauldronName, bubbleIndex) => {
    const cauldronCostLvl = state?.account?.alchemy?.cauldrons?.[cauldronName]?.boosts?.cost?.level || 0;
    const undevelopedBubbleLv = state?.account?.alchemy?.bubbles?.kazam?.[6].level || 0;
    const barleyBrewLvl = state?.account?.alchemy?.vials?.[9]?.level || 0;
    const multiBubble = cauldronName !== 'kazam'
      ? state?.account?.alchemy?.bubbles?.[cauldronName]?.[16]?.level || 0
      : 0;
    const lastBubbleLvl = state?.account?.alchemy?.bubbles?.[cauldronName]?.[14]?.level || 0;
    const classMultiplierLvl = classDiscount && cauldronName !== 'kazam'
      ? (state?.account?.alchemy?.bubbles?.[cauldronName]?.[1]?.level || 0)
      : 0;
    const shopBargainBought = bargainTag || 0;
    const smrtAchievement = state?.account?.achievements[108]?.completed;
    return calcBubbleMatCost(bubbleIndex, myFirstChemSet ? 2 : 1, bubbleLv, baseCost, isLiquid, cauldronCostLvl,
      undevelopedBubbleLv, barleyBrewLvl, lastBubbleLvl, classMultiplierLvl,
      shopBargainBought, smrtAchievement, multiBubble);
  }

  const getAccumulatedBubbleCost = (index, level, baseCost, isLiquid, cauldronName) => {
    const levelDiff = (bubblesGoals?.[cauldronName]?.[index] ?? 0) - level;
    if (levelDiff <= 0) {
      const cost = calculateMaterialCost(level, baseCost, isLiquid, cauldronName, index);
      return { singleLevelCost: cost, total: cost };
    }
    const array = new Array(levelDiff || 0).fill(1);
    let singleLevelCost = 0;
    const total = array.reduce((res, _, levelInd) => {
        const cost = calculateMaterialCost(level + (levelInd === 0
          ? 1
          : levelInd), baseCost, isLiquid, cauldronName, index);
        if (!isLiquid) {
          singleLevelCost = cost;
        }
        return res + cost;
      },
      calculateMaterialCost(level, baseCost, isLiquid, cauldronName, index)
    );
    return { total, singleLevelCost };
  }

  const accumulatedCost = useCallback((index, level, baseCost, isLiquid, cauldronName) => getAccumulatedBubbleCost(index, level, baseCost, isLiquid, cauldronName), [bubblesGoals,
    bargainTag, classDiscount]);

  const getNblbBubbles = (acc, maxBubbleIndex, numberOfBubbles) => {
    const bubblesArrays = Object.values(acc?.alchemy?.bubbles || {})
      .map((array) => array.filter(({
                                      level,
                                      index
                                    }) => level >= 5 && index < maxBubbleIndex)
        .sort((a, b) => a.level - b.level));
    const bubblePerCauldron = Math.ceil(numberOfBubbles / 4);
    const lowestBubbles = [];
    for (let j = 0; j < bubblesArrays.length; j++) {
      const bubblesArray = bubblesArrays[j];
      lowestBubbles.push(bubblesArray.slice(0, bubblePerCauldron));
    }
    return lowestBubbles.flat();
  }

  const getUpgradeableBubbles = (acc) => {
    let upgradeableBubblesAmount = 3;
    const noBubbleLeftBehind = acc?.lab?.labBonuses?.find((bonus) => bonus.name === 'No_Bubble_Left_Behind')?.active;
    if (!noBubbleLeftBehind) return null;
    const allBubbles = Object.values(acc?.alchemy?.bubbles).flatMap((bubbles, index) => {
      return bubbles.map((bubble, bubbleIndex) => {
        return { ...bubble, tab: index, flatIndex: 1e3 * index + bubbleIndex }
      });
    });

    const found = allBubbles.filter(({ level, index }) => level >= 5 && index < 15);
    const sorted = found.sort((a, b) => b.flatIndex - a.flatIndex).sort((a, b) => a.level - b.level);
    if (acc?.lab?.jewels?.find(jewel => jewel.name === 'Pyrite_Rhinestone')?.active) {
      upgradeableBubblesAmount++;
    }
    const amberiteArtifact = isArtifactAcquired(acc?.sailing?.artifacts, 'Amberite');
    if (amberiteArtifact) {
      upgradeableBubblesAmount += amberiteArtifact?.acquired === 3
        ? amberiteArtifact?.baseBonus * 3
        : amberiteArtifact?.acquired === 2 ? amberiteArtifact?.baseBonus * 2 : amberiteArtifact?.baseBonus;
    }
    const moreBubblesFromMerit = acc?.tasks?.[2]?.[3]?.[6]
    if (moreBubblesFromMerit > 0) {
      upgradeableBubblesAmount += moreBubblesFromMerit;
    }
    const normal = sorted.slice(0, upgradeableBubblesAmount);
    const atomBubbles = getNblbBubbles(acc, 25, upgradeableBubblesAmount);
    return {
      normal,
      atomBubbles
    };
  }
  const upgradeableBubbles = useMemo(() => getUpgradeableBubbles(state?.account), [state?.account]);

  const calculateBargainTag = () => {
    return parseFloat((25 * (Math.pow(0.75, bargainTag) - 1) / (0.75 - 1)).toFixed(1));
  }

  const getMaxBonus = (func, x1) => {
    if (!func?.includes('decay')) return null;
    let maxBonus = x1;
    if (func === 'decayMulti') maxBonus += 1
    return maxBonus;
  }

  return (
    <>
      <NextSeo
        title="Bubbles | Idleon Toolbox"
        description="Keep track of your bubbles level and requirements with a handy calculator"
      />
      <Typography variant={'h2'} textAlign={'center'} mb={3}>Bubbles</Typography>
      <Box sx={{ width: 'fit-content', margin: '24px auto' }}>
        <Nblb title={'Next bubble upgrades'} bubbles={upgradeableBubbles?.normal} accumulatedCost={accumulatedCost}
              account={state?.account}/>
        <Divider sx={{ my: 2 }}/>
        <Nblb lithium bubbles={upgradeableBubbles?.atomBubbles} accumulatedCost={accumulatedCost}
              account={state?.account}/>
      </Box>
      <Stack direction={'row'} justifyContent={'center'} mt={2} gap={2} flexWrap={'wrap'}>
        <Stack>
          <FormControlLabel
            control={<Checkbox checked={condenseView} onChange={() => setCondenseView(!condenseView)}/>}
            name={'Condense view'}
            label="Condense view"/>
          {Object.keys(state?.account?.alchemy?.bubbles)?.[selectedTab] !== 'kazam' ?
            <FormControlLabel
              control={<Checkbox checked={classDiscount} onChange={() => setClassDiscount(!classDiscount)}/>}
              name={'classDiscount'}
              label="Class Discount"/> : null}
        </Stack>
        <Stack gap={1}>


          <TextField sx={{ width: 150 }}
                     label={'Efficiency threshold'}
                     value={effThreshold}
                     type={'number'}
                     inputProps={{ min: 0, max: 100 }}
                     onChange={({ target }) => setEffThreshold(target.value)}
          />
          <TextField value={bargainTag}
                     type={'number'}
                     inputProps={{ min: 0, max: 8 }}
                     onChange={(e) => handleBargainChange(e)}
                     helperText={`${calculateBargainTag()}%`}
                     InputProps={{
                       startAdornment: <InputAdornment position="start">
                         <img width={36} height={36}
                              src={`${prefix}data/aShopItems10.png`} alt=""/>
                       </InputAdornment>
                     }}/>
        </Stack>
        <CardTitleAndValue cardSx={{ height: 'fit-content' }} title={'Particle upgrades'}
                           value={state?.account?.accountOptions?.[135] || '0'}/>
        <CardTitleAndValue cardSx={{ height: 'fit-content' }} title={'Total bubbles'}>
          <Stack direction={'row'} alignItems={'center'} gap={1}>
            {bubbles?.length}
            <HtmlTooltip title={<FutureBubblesTooltip/>}>
              <InfoIcon/>
            </HtmlTooltip>
          </Stack>
        </CardTitleAndValue>
      </Stack>
      <Tabber tabs={Object.keys(state?.account?.alchemy?.bubbles)} onTabChange={handleOnClick}>
        <Stack direction={'row'} flexWrap={'wrap'} gap={3} justifyContent={'center'}>
          {bubbles?.map((bubble, index) => {
            if (index > 24) return null;
            const { level, itemReq, rawName, bubbleName, func, x1, x2, cauldron } = bubble;
            const goalLevel = bubblesGoals?.[cauldron]?.[index] ? bubblesGoals?.[cauldron]?.[index] < level
              ? level
              : bubblesGoals?.[cauldron]?.[index] : level;
            const goalBonus = growth(func, goalLevel, x1, x2, true);
            const bubbleMaxBonus = getMaxBonus(func, x1);
            const effectHardCapPercent = goalLevel / (goalLevel + x2) * 100;
            return <React.Fragment key={rawName + '' + bubbleName + '' + index}>
              <Card sx={{
                width: condenseView ? 100 : 330,
                border: bubbleMaxBonus && effectHardCapPercent >= effThreshold ? '1px solid' : '',
                borderColor: 'success.main'
              }}>
                <CardContent>
                  <Stack direction={'row'} alignItems={'center'} justifyContent={'space-around'} gap={2}>
                    <Stack alignItems={'center'}>
                      <HtmlTooltip
                        dark={condenseView}
                        title={condenseView ? <AdditionalInfo tooltip bubbleMaxBonus={bubbleMaxBonus}
                                                              goalBonus={goalBonus}
                                                              cauldron={cauldron}
                                                              effectHardCapPercent={effectHardCapPercent}
                                                              itemReq={itemReq}
                                                              accumulatedCost={accumulatedCost}
                                                              account={state?.account}
                                                              level={level}
                                                              index={index}
                                                              bubble={bubble}
                                                              goalLevel={goalLevel}
                        /> : <BubbleTooltip {...{
                          ...bubble,
                          goalLevel
                        }}/>}>
                        <BubbleIcon width={48} height={48}
                                    level={level}
                                    src={`${prefix}data/${rawName}.png`}
                                    alt=""/>
                      </HtmlTooltip>
                      <Stack alignItems={'center'} justifyContent={'center'}>
                        <Typography
                          variant={'caption'}>Lv. {level}</Typography>
                        {!condenseView
                          ? <Typography variant={'caption'}>{cleanUnderscore(bubbleName)}</Typography>
                          : null}
                      </Stack>
                    </Stack>
                    {!condenseView
                      ? <TextField type={'number'}
                                   sx={{ width: 90 }}
                                   defaultValue={goalLevel}
                                   onChange={(e) => handleGoalChange(e, cauldron, index)}
                                   label={'Goal'} variant={'outlined'} inputProps={{ min: level || 0 }}/>
                      : null}
                  </Stack>
                  {!condenseView ? <AdditionalInfo bubbleMaxBonus={bubbleMaxBonus}
                                                   goalBonus={goalBonus}
                                                   cauldron={cauldron}
                                                   effectHardCapPercent={effectHardCapPercent}
                                                   itemReq={itemReq}
                                                   accumulatedCost={accumulatedCost}
                                                   account={state?.account}
                                                   level={level}
                                                   index={index}
                  /> : null}
                </CardContent>
              </Card>
            </React.Fragment>
          })}
        </Stack>
      </Tabber>
    </>
  );
};

const AdditionalInfo = ({
                          tooltip,
                          bubbleMaxBonus,
                          goalBonus,
                          effectHardCapPercent,
                          itemReq,
                          accumulatedCost,
                          index,
                          level,
                          cauldron,
                          account,
                          bubble,
                          goalLevel
                        }) => {
  return <Stack mt={1.5} direction={'row'} justifyContent={'center'} gap={3}
                flexWrap={'wrap'}>
    {tooltip ? <BubbleTooltip {...{
      ...bubble,
      goalLevel
    }}/> : null}
    <Stack gap={2} justifyContent={'center'}
           alignItems={'center'}>
      <HtmlTooltip title={'Bubble\'s effect'}>
        <BonusIcon src={`${prefix}data/SignStar3b.png`} alt=""/>
      </HtmlTooltip>
      <HtmlTooltip
        title={bubbleMaxBonus
          ? `${goalBonus} is ${notateNumber(effectHardCapPercent)}% of possible hard cap effect of ${bubbleMaxBonus}`
          : ''}>
        <Typography>{goalBonus} {bubbleMaxBonus
          ? `(${notateNumber(effectHardCapPercent)}%)`
          : ''}</Typography>
      </HtmlTooltip>
    </Stack>
    {itemReq?.map(({ rawName, name, baseCost }, itemIndex) => {
      if (rawName === 'Blank' || rawName === 'ERROR') return null;
      const {
        singleLevelCost,
        total
      } = accumulatedCost(index, level, baseCost, name?.includes('Liquid'), cauldron);
      const x1Extension = ['sail', 'bits'];
      const itemName = x1Extension.find((str) => rawName.toLowerCase().includes(str))
        ? `${rawName}_x1`
        : rawName;
      const atomCost = singleLevelCost > 1e8 && !name?.includes('Liquid') && !name?.includes('Bits') && getBubbleAtomCost(index, singleLevelCost);
      let amount;
      if (rawName.includes('Liquid')) {
        const liquids = { 'Liquid1': 0, 'Liquid2': 1, 'Liquid3': 2, 'Liquid4': 3 };
        amount = account?.alchemy?.liquids?.[liquids?.[rawName]];
      } else if (rawName.includes('Bits')) {
        amount = account?.gaming?.bits;
      } else if (rawName.includes('Sail')) {
        amount = account?.sailing?.lootPile?.find(({ rawName: lootPileName }) => lootPileName === rawName.replace('SailTr', 'SailT'))?.amount;
      } else {
        amount = account?.storage?.find(({ rawName: storageRawName }) => (storageRawName === rawName))?.amount;
      }
      return <Stack direction={'row'} key={`${rawName}-${name}-${itemIndex}`} gap={3}>
        {atomCost ? <Stack gap={2} alignItems={'center'}>
            <Tooltip title={<Typography
              color={account?.atoms?.particles > atomCost
                ? 'success.light'
                : ''}>{Math.floor(account?.atoms?.particles)} / {atomCost}</Typography>}>
              <ItemIcon src={`${prefix}etc/Particle.png`} alt=""/>
            </Tooltip>
            <HtmlTooltip title={atomCost}>
              <Typography>{notateNumber(atomCost, 'Big')}</Typography>
            </HtmlTooltip></Stack>
          : null}
        <Stack gap={2} justifyContent={'center'}
               alignItems={'center'}>
          <HtmlTooltip title={cleanUnderscore(name)}>
            <ItemIcon src={`${prefix}data/${itemName}.png`}
                      alt=""/>
          </HtmlTooltip>
          <Tooltip
            title={<Typography color={amount >= total
              ? 'success.light'
              : ''}>{notateNumber(amount, 'Big')} / {notateNumber(total, 'Big')}</Typography>}>
            <Typography>{notateNumber(total, 'Big')}</Typography>
          </Tooltip>
        </Stack>
      </Stack>
    })}
  </Stack>
}

const Nblb = ({ title, bubbles, lithium, accumulatedCost, account }) => {
  return <Stack justifyContent={'center'} alignItems={'center'}>
    <Typography>{title}</Typography>
    {lithium ? <Typography variant={'caption'}>* 15% chance to be upgraded by lithium (atom
      collider)</Typography> : null}
    <Stack direction={'row'} flexWrap={'wrap'} gap={1}>
      {bubbles?.map(({ rawName, bubbleName, level, itemReq, index, cauldron }, tIndex) => {
        const {
          singleLevelCost,
          total
        } = accumulatedCost(index, level, itemReq?.[0]?.baseCost, itemReq?.[0]?.name?.includes('Liquid'), cauldron);
        const atomCost = singleLevelCost > 1e8 && !itemReq?.[0]?.name?.includes('Liquid') && !itemReq?.[0]?.name?.includes('Bits') && getBubbleAtomCost(index, singleLevelCost);
        return <Stack alignItems={'center'} key={`${rawName}-${tIndex}-${lithium}-nblb`}>
          <HtmlTooltip title={<>
            <Typography sx={{ fontWeight: 'bold' }}>{pascalCase(cleanUnderscore(bubbleName))}</Typography>
            <Stack direction={'row'} justifyContent={'center'} gap={1}>
              {itemReq?.map(({ rawName }, index) => {
                if (rawName === 'Blank' || rawName === 'ERROR' || rawName.includes('Liquid')) return null;
                const x1Extension = ['sail', 'bits'];
                const itemName = x1Extension.find((str) => rawName.toLowerCase().includes(str))
                  ? `${rawName}_x1`
                  : rawName;
                return <Stack alignItems={'center'} direction={'row'} gap={1} key={'req' + rawName + index}>
                  <Stack alignItems={'center'} justifyContent={'space-between'}>
                    <ItemIcon src={`${prefix}data/${itemName}.png`} alt=""/>
                    <Typography>{notateNumber(total, 'Big')}</Typography>
                  </Stack>
                  {atomCost > 0 ? <Stack alignItems={'center'} justifyContent={'space-between'}>
                    <Stack sx={{ width: 32, height: 32 }} alignItems={'center'} justifyContent={'center'}>
                      <img width={18} height={18}
                           src={`${prefix}etc/Particle.png`} alt=""/>
                    </Stack>
                    <Typography>{atomCost}</Typography>
                  </Stack> : null}
                </Stack>
              })}
            </Stack>
          </>}>
            <img
              style={{ opacity: lithium ? 0.8 : 1 }}
              width={42}
              height={42}
              src={`${prefix}data/${rawName}.png`} alt=""/>
          </HtmlTooltip>
          <Stack direction={'row'} alignItems={'center'} gap={.5}>
            {atomCost > 0 ?
              <Tooltip title={<Typography
                color={account?.atoms?.particles > atomCost
                  ? 'success.light'
                  : ''}>{Math.floor(account?.atoms?.particles)} / {atomCost}</Typography>}>
                <img width={18} height={18}
                     src={`${prefix}etc/Particle.png`} alt=""/>
              </Tooltip> : null}
            <Typography variant={'body1'}>{level}</Typography>
          </Stack>
        </Stack>
      })}
    </Stack>
  </Stack>
}

const BonusIcon = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
`
const ItemIcon = styled.img`
  width: 32px;
  height: 32px;
`;

const BubbleIcon = styled.img`
  opacity: ${({ level }) => level === 0 ? .5 : 1};
`;

const BubbleTooltip = ({ goalLevel, bubbleName, desc, func, x1, x2, level }) => {
  const bonus = growth(func, level, x1, x2, true);
  const goalBonus = growth(func, goalLevel, x1, x2, true);
  return <>
    <Typography fontWeight={'bold'} variant={'h6'}>{cleanUnderscore(bubbleName)}</Typography>
    <Typography variant={'body1'}>{cleanUnderscore(desc.replace(/{/, bonus))}</Typography>
    {level !== goalLevel ? <Typography sx={{ color: level > 0 ? 'multi' : '' }}
                                       variant={'body1'}>Goal:
      +{goalBonus}</Typography> : null}
  </>
}

const FutureBubblesTooltip = () => {
  const arr = new Array(15).fill(25).map((bubbleIndex, index) => getMaxCauldron(bubbleIndex + index)).toChunks(5);
  return <Stack gap={2}>
    {arr.map((chunk, index) => {
      return <Stack key={index}>
        <Typography sx={{ fontWeight: 'bold' }}>World {6 + index}</Typography>
        <Stack>
          {chunk.map((i, bIndex) => {
            const currentIndex = 26 + (index * 5) + bIndex;
            return <Typography key={i}>{currentIndex} - {notateNumber(i)}</Typography>
          })}
        </Stack>
      </Stack>
    })}
  </Stack>
}

export default Bubbles;
