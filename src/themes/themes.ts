import { seasonOn } from '../lib/season'
import type { CSSProperties } from 'react'

export type Ambient = 'none' | 'petals' | 'stars' | 'bubbles' | 'leaves' | 'hearts' | 'sparkles' | 'aurora' | 'scanlines' | 'haze' | 'bats' | 'lovebeat' | 'party' | 'embers' | 'fog' | 'matrix'

export type ThemeDef = {
  id: string
  name: string
  scheme: 'light' | 'dark'
  ambient: Ambient
  bg: string
  ink: string
  meta: string
  header: string
  sent: [string, string, string]
  sentInk: string
  recv: string
  recvInk: string
  accent: string
  accentInk: string
  composer: string
  composerInk: string
  mono?: boolean
}

type Palette = Omit<ThemeDef, 'id' | 'name' | 'scheme' | 'ambient' | 'mono'>
type ThemeSpec = { id: string; name: string; ambient: Ambient; mono?: boolean; light: Palette; dark: Palette }

/*
 * Every theme has a light and a dark palette. Dark palettes are built for 2am:
 * tinted near-black backgrounds (never #000), off-white ink (never #FFF), sent bubbles in
 * mid tones that keep white text above 4.5:1, and nothing large and bright.
 */
const SPECS: ThemeSpec[] = [
  {
    id: 'goofy', name: 'goofy', ambient: 'none',
    light: {
      bg: 'radial-gradient(circle at 1px 1px, rgba(23,19,31,.075) 1px, transparent 0) 0 0/22px 22px, #FBF5EC',
      ink: '#17131F', meta: 'rgba(23,19,31,.52)', header: 'rgba(251,245,236,.84)',
      sent: ['#FFC83D', '#FF9A3D', '#FF6F61'], sentInk: '#17131F',
      recv: '#FFFFFF', recvInk: '#17131F', accent: '#FF5C39', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#17131F',
    },
    dark: {
      bg: 'radial-gradient(circle at 1px 1px, rgba(246,241,234,.06) 1px, transparent 0) 0 0/22px 22px, #121016',
      ink: '#F1ECE4', meta: 'rgba(241,236,228,.52)', header: 'rgba(18,16,22,.86)',
      sent: ['#6E3F1C', '#6D2F24', '#64243A'], sentInk: '#F1ECE4',
      recv: '#221E29', recvInk: '#F1ECE4', accent: '#FF6A47', accentInk: '#17131F',
      composer: '#1D1923', composerInk: '#F1ECE4',
    },
  },
  {
    id: 'cherry', name: 'cherry blossom', ambient: 'petals',
    light: {
      bg: 'radial-gradient(120% 80% at 100% 0%, #FFDDE8 0%, transparent 60%), radial-gradient(100% 70% at 0% 100%, #FFD3E1 0%, transparent 55%), #FFF6F9',
      ink: '#4A1E2E', meta: 'rgba(74,30,46,.55)', header: 'rgba(255,240,245,.82)',
      sent: ['#E2185F', '#D4316E', '#C03A72'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#4A1E2E', accent: '#D63C7A', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#4A1E2E',
    },
    dark: {
      bg: 'radial-gradient(110% 70% at 100% 0%, rgba(120,30,70,.38) 0%, transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(90,20,55,.35) 0%, transparent 60%), #160B12',
      ink: '#F8E1EA', meta: 'rgba(248,225,234,.52)', header: 'rgba(22,11,18,.86)',
      sent: ['#702445', '#6A2041', '#5F1C3C'], sentInk: '#F8E1EA',
      recv: '#2A1620', recvInk: '#F8E1EA', accent: '#E25C93', accentInk: '#1A0A12',
      composer: '#22121B', composerInk: '#F8E1EA',
    },
  },
  {
    id: 'midnight', name: 'midnight', ambient: 'stars',
    light: {
      bg: 'radial-gradient(90% 60% at 80% 0%, #DCE3FF 0%, transparent 60%), linear-gradient(180deg, #EEF1FF 0%, #E2E7FA 100%)',
      ink: '#141C45', meta: 'rgba(20,28,69,.55)', header: 'rgba(238,241,255,.84)',
      sent: ['#346CEE', '#3A62E0', '#4B45D8'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#141C45', accent: '#3A62E0', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#141C45',
    },
    dark: {
      bg: 'radial-gradient(90% 60% at 80% 0%, #1A2552 0%, transparent 60%), linear-gradient(180deg, #0B1026 0%, #070A14 100%)',
      ink: '#E2E6FA', meta: 'rgba(226,230,250,.52)', header: 'rgba(11,16,38,.84)',
      sent: ['#213B73', '#1F326B', '#201D5D'], sentInk: '#E2E6FA',
      recv: '#1A2142', recvInk: '#E2E6FA', accent: '#5B84FF', accentInk: '#0A0F26',
      composer: '#141A35', composerInk: '#E2E6FA',
    },
  },
  {
    id: 'matcha', name: 'matcha latte', ambient: 'leaves',
    light: {
      bg: 'radial-gradient(90% 60% at 0% 0%, #DCE8C4 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, #EFE6D2 0%, transparent 60%), #F2F2E4',
      ink: '#2D3A1F', meta: 'rgba(45,58,31,.55)', header: 'rgba(242,242,228,.84)',
      sent: ['#5F7C37', '#597D31', '#557D2B'], sentInk: '#FFFFFF',
      recv: '#FFFDF6', recvInk: '#2D3A1F', accent: '#5E8A33', accentInk: '#FFFFFF',
      composer: '#FFFDF6', composerInk: '#2D3A1F',
    },
    dark: {
      bg: 'radial-gradient(90% 60% at 0% 0%, rgba(80,110,40,.32) 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, rgba(90,70,40,.25) 0%, transparent 60%), #11150D',
      ink: '#E6EDD8', meta: 'rgba(230,237,216,.52)', header: 'rgba(17,21,13,.86)',
      sent: ['#364C1F', '#354E1D', '#334F1C'], sentInk: '#E6EDD8',
      recv: '#1F2718', recvInk: '#E6EDD8', accent: '#8DBA55', accentInk: '#11150D',
      composer: '#1A2114', composerInk: '#E6EDD8',
    },
  },
  {
    id: 'lagoon', name: 'lagoon', ambient: 'bubbles',
    light: {
      bg: 'linear-gradient(180deg, #E2F8F6 0%, #BDEBE9 100%)',
      ink: '#0E3B40', meta: 'rgba(14,59,64,.56)', header: 'rgba(226,248,246,.84)',
      sent: ['#188177', '#127E7D', '#0E7480'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#0E3B40', accent: '#11868A', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#0E3B40',
    },
    dark: {
      bg: 'radial-gradient(90% 60% at 50% 0%, rgba(20,110,115,.35) 0%, transparent 65%), linear-gradient(180deg, #06191C 0%, #041114 100%)',
      ink: '#D8F3F1', meta: 'rgba(216,243,241,.52)', header: 'rgba(6,25,28,.86)',
      sent: ['#18534E', '#185253', '#195057'], sentInk: '#D8F3F1',
      recv: '#0F2A2E', recvInk: '#D8F3F1', accent: '#3CC8BE', accentInk: '#04171A',
      composer: '#0C2327', composerInk: '#D8F3F1',
    },
  },
  {
    id: 'lavender', name: 'lavender haze', ambient: 'haze',
    light: {
      bg: 'radial-gradient(70% 50% at 20% 20%, #E7DAFF 0%, transparent 70%), radial-gradient(60% 50% at 90% 80%, #D9E1FF 0%, transparent 70%), #F6F1FF',
      ink: '#2F2450', meta: 'rgba(47,36,80,.55)', header: 'rgba(246,241,255,.84)',
      sent: ['#775CED', '#7062E3', '#5F5DD6'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#2F2450', accent: '#6B5BE0', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#2F2450',
    },
    dark: {
      bg: 'radial-gradient(70% 50% at 20% 20%, rgba(110,80,200,.28) 0%, transparent 70%), radial-gradient(60% 50% at 90% 80%, rgba(70,90,190,.22) 0%, transparent 70%), #110E1C',
      ink: '#E9E3FB', meta: 'rgba(233,227,251,.52)', header: 'rgba(17,14,28,.86)',
      sent: ['#2E2173', '#2C2366', '#262357'], sentInk: '#E9E3FB',
      recv: '#211B34', recvInk: '#E9E3FB', accent: '#9C8AF5', accentInk: '#110E1C',
      composer: '#1B162B', composerInk: '#E9E3FB',
    },
  },
  {
    id: 'terminal', name: 'terminal', ambient: 'scanlines', mono: true,
    light: {
      bg: 'radial-gradient(90% 70% at 50% 40%, #F3F8EE 0%, #E4EDDC 100%)',
      ink: '#0F3D1C', meta: 'rgba(15,61,28,.58)', header: 'rgba(240,246,234,.88)',
      sent: ['#1E6B35', '#1A5E2E', '#155226'], sentInk: '#E9FFEF',
      recv: '#FFFFFF', recvInk: '#0F3D1C', accent: '#1A7A3A', accentInk: '#F0FFF4',
      composer: '#FBFDF8', composerInk: '#0F3D1C',
    },
    dark: {
      bg: 'radial-gradient(90% 70% at 50% 40%, #0E1A10 0%, #060A06 100%)',
      ink: '#7CF29A', meta: 'rgba(124,242,154,.55)', header: 'rgba(6,10,6,.88)',
      sent: ['#123D20', '#0F3319', '#0C2914'], sentInk: '#9BFFB5',
      recv: '#142414', recvInk: '#CDF5D7', accent: '#39E866', accentInk: '#052A0F',
      composer: '#0C130C', composerInk: '#9CF5B1',
    },
  },
  {
    id: 'bubblegum', name: 'bubblegum', ambient: 'hearts',
    light: {
      bg: 'radial-gradient(80% 60% at 0% 0%, #FFD0EC 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, #CBEAFF 0%, transparent 60%), #FFF3FA',
      ink: '#3B1740', meta: 'rgba(59,23,64,.55)', header: 'rgba(255,243,250,.84)',
      sent: ['#DC1C84', '#A945D2', '#2374CA'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#3B1740', accent: '#E0409C', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#3B1740',
    },
    dark: {
      bg: 'radial-gradient(80% 60% at 0% 0%, rgba(160,40,120,.3) 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, rgba(40,100,170,.28) 0%, transparent 60%), #150E1A',
      ink: '#FBE4F3', meta: 'rgba(251,228,243,.52)', header: 'rgba(21,14,26,.86)',
      sent: ['#712250', '#4E2663', '#1D395D'], sentInk: '#FBE4F3',
      recv: '#26192D', recvInk: '#FBE4F3', accent: '#F062B4', accentInk: '#150E1A',
      composer: '#1F1525', composerInk: '#FBE4F3',
    },
  },
  {
    id: 'citrus', name: 'lemonade', ambient: 'sparkles',
    light: {
      bg: 'radial-gradient(80% 60% at 100% 0%, #FFF2A0 0%, transparent 60%), radial-gradient(70% 60% at 0% 100%, #E6F7A8 0%, transparent 60%), #FFFBE2',
      ink: '#2E2A05', meta: 'rgba(46,42,5,.56)', header: 'rgba(255,251,226,.86)',
      sent: ['#FFE44D', '#D9F04A', '#9FE05D'], sentInk: '#232205',
      recv: '#FFFFFF', recvInk: '#2E2A05', accent: '#2E2A05', accentInk: '#FFE44D',
      composer: '#FFFFFF', composerInk: '#2E2A05',
    },
    dark: {
      bg: 'radial-gradient(80% 60% at 100% 0%, rgba(150,130,20,.26) 0%, transparent 60%), radial-gradient(70% 60% at 0% 100%, rgba(90,130,20,.22) 0%, transparent 60%), #13120A',
      ink: '#F8F3D2', meta: 'rgba(248,243,210,.52)', header: 'rgba(19,18,10,.86)',
      sent: ['#44531A', '#2B5320', '#1C4B32'], sentInk: '#F8F3D2',
      recv: '#24220F', recvInk: '#F8F3D2', accent: '#F2D43A', accentInk: '#1A1904',
      composer: '#1D1B0C', composerInk: '#F8F3D2',
    },
  },
  {
    id: 'aurora', name: 'aurora', ambient: 'aurora',
    light: {
      bg: 'linear-gradient(180deg, #E8FBF4 0%, #DCF1F7 100%)',
      ink: '#0B3A33', meta: 'rgba(11,58,51,.56)', header: 'rgba(232,251,244,.84)',
      sent: ['#108364', '#138083', '#1A73A0'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#0B3A33', accent: '#0F8C6C', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#0B3A33',
    },
    dark: {
      bg: 'linear-gradient(180deg, #06121A 0%, #050B10 100%)',
      ink: '#DCF7EE', meta: 'rgba(220,247,238,.52)', header: 'rgba(6,18,26,.84)',
      sent: ['#185340', '#185352', '#1C4C5F'], sentInk: '#DCF7EE',
      recv: '#13222B', recvInk: '#DCF7EE', accent: '#3DE0A6', accentInk: '#03201A',
      composer: '#0F1B22', composerInk: '#DCF7EE',
    },
  },
  {
    id: 'forest', name: 'forest', ambient: 'leaves',
    light: {
      bg: 'radial-gradient(90% 60% at 50% 0%, #D4E9D8 0%, transparent 70%), #EEF5EE',
      ink: '#173326', meta: 'rgba(23,51,38,.56)', header: 'rgba(238,245,238,.86)',
      sent: ['#288354', '#25855A', '#1D704C'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#173326', accent: '#22805A', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#173326',
    },
    dark: {
      bg: 'radial-gradient(90% 60% at 50% 0%, #1F4A35 0%, transparent 70%), #0D1D15',
      ink: '#DFEFE3', meta: 'rgba(223,239,227,.52)', header: 'rgba(13,29,21,.86)',
      sent: ['#1D532A', '#205033', '#195236'], sentInk: '#DFEFE3',
      recv: '#18332A', recvInk: '#DFEFE3', accent: '#53C77F', accentInk: '#06170D',
      composer: '#132A20', composerInk: '#DFEFE3',
    },
  },
  {
    id: 'y2k', name: 'y2k chrome', ambient: 'sparkles',
    light: {
      bg: 'linear-gradient(135deg, #EDF1F7 0%, #CBD5E5 22%, #F7F9FC 48%, #C3CDDF 74%, #ECF0F6 100%)',
      ink: '#1B2233', meta: 'rgba(27,34,51,.55)', header: 'rgba(237,241,247,.84)',
      sent: ['#8ED6FF', '#B8A8FF', '#FF9FE0'], sentInk: '#1B2233',
      recv: '#FFFFFF', recvInk: '#1B2233', accent: '#3E6BFF', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#1B2233',
    },
    dark: {
      bg: 'linear-gradient(135deg, #151A24 0%, #252C3B 24%, #12161F 50%, #222938 76%, #141822 100%)',
      ink: '#E3E9F5', meta: 'rgba(227,233,245,.52)', header: 'rgba(21,26,36,.86)',
      sent: ['#224B6D', '#2E2465', '#55264C'], sentInk: '#E3E9F5',
      recv: '#242B3A', recvInk: '#E3E9F5', accent: '#7C9BFF', accentInk: '#10141D',
      composer: '#1D2330', composerInk: '#E3E9F5',
    },
  },
  {
    id: 'batman', name: 'batman', ambient: 'bats',
    light: {
      bg: 'radial-gradient(70% 45% at 50% 0%, rgba(255,214,0,.22) 0%, transparent 70%), linear-gradient(180deg, #B9C1CF 0%, #D6DBE4 55%, #E6E9EF 100%)',
      ink: '#12151C', meta: 'rgba(18,21,28,.58)', header: 'rgba(206,212,223,.88)',
      sent: ['#FFE24D', '#FFD000', '#F0B400'], sentInk: '#0B0B0E',
      recv: '#FFFFFF', recvInk: '#12151C', accent: '#12151C', accentInk: '#FFD000',
      composer: '#F4F5F8', composerInk: '#12151C',
    },
    dark: {
      bg: 'radial-gradient(70% 45% at 50% 0%, rgba(255,214,0,.11) 0%, transparent 70%), linear-gradient(180deg, #171A22 0%, #0C0E13 60%, #07080B 100%)',
      ink: '#E9EBF0', meta: 'rgba(233,235,240,.52)', header: 'rgba(10,11,15,.86)',
      sent: ['#2C303A', '#272A33', '#212430'], sentInk: '#F2C800',
      recv: '#1C1F27', recvInk: '#E9EBF0', accent: '#F2C800', accentInk: '#0B0B0E',
      composer: '#171A21', composerInk: '#E9EBF0',
    },
  },
  {
    id: 'spooky', name: 'spooky', ambient: 'fog',
    light: {
      bg: 'radial-gradient(80% 50% at 50% 0%, rgba(255,138,30,.22) 0%, transparent 70%), linear-gradient(180deg, #E9DDF2 0%, #DCCDE8 60%, #CFC0DF 100%)',
      ink: '#1D1029', meta: 'rgba(29,16,41,.58)', header: 'rgba(233,221,242,.86)',
      sent: ['#FF9A3C', '#FF8A1E', '#EE7A0C'], sentInk: '#1D1029',
      recv: '#FFFFFF', recvInk: '#1D1029', accent: '#5B2A86', accentInk: '#FFFFFF',
      composer: '#F6F0FA', composerInk: '#1D1029',
    },
    dark: {
      bg: 'radial-gradient(70% 45% at 50% 0%, rgba(255,138,30,.14) 0%, transparent 70%), linear-gradient(180deg, #1A1024 0%, #110A18 60%, #0A0610 100%)',
      ink: '#EEE6F5', meta: 'rgba(238,230,245,.52)', header: 'rgba(14,8,20,.86)',
      sent: ['#3A2148', '#331D40', '#2B1836'], sentInk: '#FFA347',
      recv: '#21152B', recvInk: '#EEE6F5', accent: '#FF8A1E', accentInk: '#1A0F00',
      composer: '#1A1122', composerInk: '#EEE6F5',
    },
  },
  {
    id: 'matrix', name: 'matrix', ambient: 'matrix', mono: true,
    light: {
      bg: '#000000',
      ink: '#B8FFC4', meta: 'rgba(0,255,65,.55)', header: 'rgba(0,0,0,.86)',
      sent: ['#00FF41', '#00E63B', '#00C934'], sentInk: '#001A06',
      recv: 'rgba(3,22,9,.92)', recvInk: '#00FF41', accent: '#00FF41', accentInk: '#000000',
      composer: '#020B04', composerInk: '#00FF41',
    },
    dark: {
      bg: '#000000',
      ink: '#B8FFC4', meta: 'rgba(0,255,65,.55)', header: 'rgba(0,0,0,.86)',
      sent: ['#00FF41', '#00E63B', '#00C934'], sentInk: '#001A06',
      recv: 'rgba(3,22,9,.92)', recvInk: '#00FF41', accent: '#00FF41', accentInk: '#000000',
      composer: '#020B04', composerInk: '#00FF41',
    },
  },
  {
    id: 'love', name: 'love', ambient: 'lovebeat',
    light: {
      bg: 'radial-gradient(90% 55% at 50% 115%, #FFB0C4 0%, transparent 62%), radial-gradient(70% 45% at 0% 0%, #FFD9E3 0%, transparent 60%), radial-gradient(60% 40% at 100% 20%, #FFE3EA 0%, transparent 60%), #FFF2F5',
      ink: '#5B0F25', meta: 'rgba(91,15,37,.55)', header: 'rgba(255,242,245,.84)',
      sent: ['#E3164D', '#DB2556', '#BE0E3E'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#5B0F25', accent: '#DB2556', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#5B0F25',
    },
    dark: {
      bg: 'radial-gradient(90% 55% at 50% 115%, rgba(170,20,60,.42) 0%, transparent 62%), radial-gradient(70% 45% at 0% 0%, rgba(110,20,45,.3) 0%, transparent 60%), #18090F',
      ink: '#FADDE5', meta: 'rgba(250,221,229,.52)', header: 'rgba(24,9,15,.86)',
      sent: ['#732139', '#6B1F36', '#5F1C32'], sentInk: '#FADDE5',
      recv: '#2A121B', recvInk: '#FADDE5', accent: '#F05A82', accentInk: '#18090F',
      composer: '#22101A', composerInk: '#FADDE5',
    },
  },
  {
    id: 'bff', name: 'bff', ambient: 'party',
    light: {
      bg: 'radial-gradient(60% 40% at 0% 0%, #FFE98A 0%, transparent 65%), radial-gradient(60% 45% at 100% 30%, #FFC4EA 0%, transparent 65%), radial-gradient(70% 45% at 30% 100%, #BFE3FF 0%, transparent 65%), #FFF8EC',
      ink: '#2A1A4A', meta: 'rgba(42,26,74,.55)', header: 'rgba(255,248,236,.84)',
      sent: ['#7A5AF0', '#D5248A', '#B45B1A'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#2A1A4A', accent: '#6E4FE8', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#2A1A4A',
    },
    dark: {
      bg: 'radial-gradient(60% 40% at 0% 0%, rgba(150,120,20,.22) 0%, transparent 65%), radial-gradient(60% 45% at 100% 30%, rgba(160,40,120,.24) 0%, transparent 65%), radial-gradient(70% 45% at 30% 100%, rgba(40,100,170,.24) 0%, transparent 65%), #14101D',
      ink: '#ECE6FA', meta: 'rgba(236,230,250,.52)', header: 'rgba(20,16,29,.86)',
      sent: ['#312173', '#69214C', '#5F361C'], sentInk: '#ECE6FA',
      recv: '#231D32', recvInk: '#ECE6FA', accent: '#9479FF', accentInk: '#14101D',
      composer: '#1D182A', composerInk: '#ECE6FA',
    },
  },
  {
    id: 'lust', name: 'lust', ambient: 'embers',
    light: {
      bg: 'radial-gradient(85% 55% at 50% 105%, #FFC2CF 0%, transparent 70%), radial-gradient(60% 40% at 100% 0%, #FFD9E6 0%, transparent 70%), #FFF1F4',
      ink: '#4A0A1E', meta: 'rgba(74,10,30,.56)', header: 'rgba(255,241,244,.86)',
      sent: ['#E21945', '#C8103F', '#9E0A34'], sentInk: '#FFFFFF',
      recv: '#FFFFFF', recvInk: '#4A0A1E', accent: '#C8103F', accentInk: '#FFFFFF',
      composer: '#FFFFFF', composerInk: '#4A0A1E',
    },
    dark: {
      bg: 'radial-gradient(85% 55% at 50% 105%, rgba(170,0,42,.42) 0%, transparent 70%), radial-gradient(60% 40% at 100% 0%, rgba(120,0,88,.32) 0%, transparent 70%), radial-gradient(50% 35% at 0% 30%, rgba(80,0,36,.3) 0%, transparent 70%), #0E0508',
      ink: '#F9DFE6', meta: 'rgba(249,223,230,.52)', header: 'rgba(14,5,8,.86)',
      sent: ['#73212F', '#6B1F30', '#5F1C36'], sentInk: '#F9DFE6',
      recv: '#23101A', recvInk: '#F9DFE6', accent: '#F03558', accentInk: '#FFF2F5',
      composer: '#1B0A12', composerInk: '#F9DFE6',
    },
  },
]

export type ThemeMode = 'light' | 'dark'

/** Which mode the app is in. Set by src/themes/mode.ts; read lazily so this module stays pure. */
let currentMode: ThemeMode = 'light'
export function setCurrentMode(m: ThemeMode) {
  currentMode = m
}

function build(spec: ThemeSpec, mode: ThemeMode): ThemeDef {
  return { id: spec.id, name: spec.name, ambient: spec.ambient, mono: spec.mono, scheme: mode, ...spec[mode] }
}

const byId = new Map(SPECS.map((t) => [t.id, t]))
export const THEME_IDS = SPECS.map((t) => t.id)

export function getTheme(id: string | null | undefined, mode: ThemeMode = currentMode): ThemeDef {
  return build((id && (id !== 'spooky' || seasonOn('spooky')) && byId.get(id)) || SPECS[0], mode)
}

export function themeList(mode: ThemeMode = currentMode): ThemeDef[] {
  return SPECS.filter((s) => s.id !== 'spooky' || seasonOn('spooky')).map((s) => build(s, mode))
}

/** Back compat: theme list in the current mode. */
export const THEMES: ThemeDef[] = themeList('light')

export function themeVars(t: ThemeDef): CSSProperties {
  return {
    '--theme-bg': t.bg,
    '--theme-ink': t.ink,
    '--theme-meta': t.meta,
    '--theme-header': t.header,
    '--theme-sent-1': t.sent[0],
    '--theme-sent-2': t.sent[1],
    '--theme-sent-3': t.sent[2],
    '--theme-sent-ink': t.sentInk,
    '--theme-recv': t.recv,
    '--theme-recv-ink': t.recvInk,
    '--theme-accent': t.accent,
    '--theme-accent-ink': t.accentInk,
    '--theme-composer': t.composer,
    '--theme-composer-ink': t.composerInk,
    '--theme-font': t.mono ? 'var(--font-mono)' : 'var(--font-text)',
    colorScheme: t.scheme,
  } as CSSProperties
}
