'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { fadeInAnimation, cardHover, shimmer } from '@/styles/animations';
import AnimatedNumber from '@/components/shared/AnimatedNumber';

const Container = styled.div`
  ${fadeInAnimation}
`;

const TabContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  background: none;
  border: none;
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ theme }) => theme.colors.primary};
    transform: scaleX(${({ $active }) => $active ? 1 : 0});
    transition: transform 0.2s ease;
  }
  
  &:hover {
    color: ${({ theme }) => theme.colors.primaryLight};
  }
`;

const LeaderboardTable = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 60px 2fr 1fr 1fr 1fr;
  padding: ${({ theme }) => theme.spacing.md};
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const LeaderboardRow = styled.div<{ $isHighlighted?: boolean }>`
  display: grid;
  grid-template-columns: 60px 2fr 1fr 1fr 1fr;
  padding: ${({ theme }) => theme.spacing.md};
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
  background: ${({ $isHighlighted }) => $isHighlighted ? 'rgba(109, 102, 214, 0.1)' : 'transparent'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const Rank = styled.div<{ $rank: number }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ $rank, theme }) => {
    if ($rank === 1) return '#FFD700';
    if ($rank === 2) return '#C0C0C0';
    if ($rank === 3) return '#CD7F32';
    return theme.colors.textPrimary;
  }};
  text-align: center;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const UserName = styled.span`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const StatValue = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const AchievementsSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const SectionTitle = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const AchievementGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const AchievementCard = styled.div<{ $unlocked: boolean }>`
  background: ${({ $unlocked }) => $unlocked ? 'rgba(109, 102, 214, 0.1)' : 'rgba(255, 255, 255, 0.03)'};
  border: 1px solid ${({ $unlocked, theme }) => $unlocked ? theme.colors.primary + '40' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  ${cardHover}
  opacity: ${({ $unlocked }) => $unlocked ? 1 : 0.6};
  position: relative;
  overflow: hidden;
  
  ${({ $unlocked }) => $unlocked && `
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(109, 102, 214, 0.3), transparent);
      animation: ${shimmer} 3s infinite;
    }
  `}
`;

const AchievementIcon = styled.div`
  font-size: 40px;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const AchievementName = styled.h4`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
`;

const AchievementDescription = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ProgressBar = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
`;

const Progress = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.primary};
  transition: width 0.5s ease;
`;

interface LeaderboardUser {
  rank: number;
  address: string;
  name: string;
  avatar: string;
  trades: number;
  volume: number;
  successRate: number;
  isCurrentUser?: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  unlocked: boolean;
}

type TabType = 'trades' | 'volume' | 'rate';

const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('volume');
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Mock data
  const mockLeaderboard: LeaderboardUser[] = [
    {
      rank: 1,
      address: '9WzD...4nKb',
      name: 'WhaleKing',
      avatar: '/api/placeholder/40/40',
      trades: 342,
      volume: 12458.5,
      successRate: 94.2,
    },
    {
      rank: 2,
      address: '7Xf8...9mNp',
      name: 'TradeWizard',
      avatar: '/api/placeholder/40/40',
      trades: 298,
      volume: 9876.3,
      successRate: 91.8,
    },
    {
      rank: 3,
      address: '3Qw2...7kLm',
      name: 'NFTMaster',
      avatar: '/api/placeholder/40/40',
      trades: 256,
      volume: 8234.1,
      successRate: 89.5,
    },
    {
      rank: 4,
      address: '5Ty9...2wQx',
      name: 'You',
      avatar: '/api/placeholder/40/40',
      trades: 47,
      volume: 1234.5,
      successRate: 89.4,
      isCurrentUser: true,
    },
  ];

  const mockAchievements: Achievement[] = [
    {
      id: '1',
      name: 'First Trade',
      description: 'Complete your first successful trade',
      icon: '🎯',
      progress: 1,
      total: 1,
      unlocked: true,
    },
    {
      id: '2',
      name: 'Trade Master',
      description: 'Complete 100 successful trades',
      icon: '🏆',
      progress: 47,
      total: 100,
      unlocked: false,
    },
    {
      id: '3',
      name: 'High Roller',
      description: 'Trade NFTs worth over 1000 SOL',
      icon: '💎',
      progress: 1234.5,
      total: 1000,
      unlocked: true,
    },
    {
      id: '4',
      name: 'Loop Legend',
      description: 'Participate in a 5+ way trade loop',
      icon: '🔄',
      progress: 3,
      total: 5,
      unlocked: false,
    },
  ];

  useEffect(() => {
    setTimeout(() => {
      setLeaderboardData(mockLeaderboard);
      setAchievements(mockAchievements);
      setLoading(false);
    }, 1000);
  }, []);

  const sortedData = [...leaderboardData].sort((a, b) => {
    switch (activeTab) {
      case 'trades':
        return b.trades - a.trades;
      case 'volume':
        return b.volume - a.volume;
      case 'rate':
        return b.successRate - a.successRate;
      default:
        return 0;
    }
  });

  return (
    <Container>
      <TabContainer>
        <Tab $active={activeTab === 'volume'} onClick={() => setActiveTab('volume')}>
          Top Volume
        </Tab>
        <Tab $active={activeTab === 'trades'} onClick={() => setActiveTab('trades')}>
          Most Trades
        </Tab>
        <Tab $active={activeTab === 'rate'} onClick={() => setActiveTab('rate')}>
          Success Rate
        </Tab>
      </TabContainer>

      <LeaderboardTable>
        <TableHeader>
          <div>Rank</div>
          <div>User</div>
          <div>Trades</div>
          <div>Volume</div>
          <div>Success Rate</div>
        </TableHeader>

        {sortedData.map((user, index) => (
          <LeaderboardRow key={user.address} $isHighlighted={user.isCurrentUser}>
            <Rank $rank={index + 1}>
              {index + 1 <= 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
            </Rank>
            <UserInfo>
              <Avatar src={user.avatar} alt={user.name} />
              <UserName>{user.name}</UserName>
            </UserInfo>
            <StatValue>
              <AnimatedNumber value={user.trades} />
            </StatValue>
            <StatValue>
              ◎<AnimatedNumber value={user.volume} decimals={1} />
            </StatValue>
            <StatValue>
              <AnimatedNumber value={user.successRate} decimals={1} />%
            </StatValue>
          </LeaderboardRow>
        ))}
      </LeaderboardTable>

      <AchievementsSection>
        <SectionTitle>
          <span>🏅</span>
          Your Achievements
        </SectionTitle>
        
        <AchievementGrid>
          {achievements.map(achievement => (
            <AchievementCard key={achievement.id} $unlocked={achievement.unlocked}>
              <AchievementIcon>{achievement.icon}</AchievementIcon>
              <AchievementName>{achievement.name}</AchievementName>
              <AchievementDescription>{achievement.description}</AchievementDescription>
              {!achievement.unlocked && (
                <>
                  <ProgressBar>
                    <Progress $percent={(achievement.progress / achievement.total) * 100} />
                  </ProgressBar>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                    {achievement.progress} / {achievement.total}
                  </div>
                </>
              )}
            </AchievementCard>
          ))}
        </AchievementGrid>
      </AchievementsSection>
    </Container>
  );
};

export default Leaderboard; 