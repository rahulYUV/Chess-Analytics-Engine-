"""
Chess Player Performance Analysis - Feature Extraction & Statistical Testing
Dataset: Lichess Games Dataset (Kaggle) - ~20,000 games
"""

import sys
import pandas as pd
import numpy as np
from scipy import stats

def load_data(path):
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} games.")
    print(df.columns.tolist())
    return df

def clean_data(df):
    df = df[df['rated'] == True].copy()
    df = df.dropna(subset=['white_rating', 'black_rating', 'winner', 'opening_name', 'turns'])
    df['avg_rating'] = (df['white_rating'] + df['black_rating']) / 2

    bins = [0, 1200, 1500, 1800, 2100, 3000]
    labels = ['<1200', '1200-1500', '1500-1800', '1800-2100', '2100+']
    df['rating_band'] = pd.cut(df['avg_rating'], bins=bins, labels=labels)

    print(f"After cleaning: {len(df)} games.")
    return df


def rq1_opening_diversity(df):
    print("\n=== RQ1: Rating vs Opening Diversity ===")

    white = df[['white_id', 'white_rating', 'opening_name']].rename(
        columns={'white_id': 'player_id', 'white_rating': 'rating'})
    black = df[['black_id', 'black_rating', 'opening_name']].rename(
        columns={'black_id': 'player_id', 'black_rating': 'rating'})
    long_df = pd.concat([white, black], ignore_index=True)

    player_stats = long_df.groupby('player_id').agg(
        avg_rating=('rating', 'mean'),
        games_played=('opening_name', 'count'),
        distinct_openings=('opening_name', 'nunique')
    ).reset_index()

    player_stats = player_stats[player_stats['games_played'] >= 3]
    player_stats['opening_diversity'] = player_stats['distinct_openings'] / player_stats['games_played']

    corr, p_value = stats.pearsonr(player_stats['avg_rating'], player_stats['opening_diversity'])
    print(f"Players analyzed: {len(player_stats)}")
    print(f"Pearson correlation (rating vs opening diversity): r={corr:.4f}, p={p_value:.4g}")

    return player_stats, corr, p_value


def rq2_white_black_winrate(df):
    print("\n=== RQ2: White vs Black Win Rate ===")

    decisive = df[df['winner'].isin(['white', 'black'])]
    total = len(decisive)
    white_wins = (decisive['winner'] == 'white').sum()
    black_wins = (decisive['winner'] == 'black').sum()

    white_rate = white_wins / total
    black_rate = black_wins / total
    print(f"Decisive games: {total} (draws excluded)")
    print(f"White win rate: {white_rate:.4f} ({white_wins} wins)")
    print(f"Black win rate: {black_rate:.4f} ({black_wins} wins)")

    chi2, p_value = stats.chisquare([white_wins, black_wins], f_exp=[total/2, total/2])
    print(f"Chi-square test vs 50/50 split: chi2={chi2:.4f}, p={p_value:.4g}")

    return white_rate, black_rate, chi2, p_value


def rq3_turns_vs_rating(df):
    print("\n=== RQ3: Game Length (turns) vs Rating ===")

    corr, p_value = stats.pearsonr(df['avg_rating'], df['turns'])
    print(f"Games analyzed: {len(df)}")
    print(f"Pearson correlation (rating vs turns): r={corr:.4f}, p={p_value:.4g}")

    return corr, p_value


def main():
    if len(sys.argv) < 2:
        print("Usage: python chess_analysis.py <path_to_games.csv>")
        sys.exit(1)

    path = sys.argv[1]
    df = load_data(path)
    df = clean_data(df)

    player_stats, r1, p1 = rq1_opening_diversity(df)
    white_rate, black_rate, chi2, p2 = rq2_white_black_winrate(df)
    r3, p3 = rq3_turns_vs_rating(df)

    print("\n=== SUMMARY ===")
    print(f"RQ1 (rating vs opening diversity): r={r1:.4f}, p={p1:.4g}, "
          f"{'SIGNIFICANT' if p1 < 0.05 else 'not significant'}")
    print(f"RQ2 (white vs black win rate): white={white_rate:.4f}, black={black_rate:.4f}, "
          f"p={p2:.4g}, {'SIGNIFICANT' if p2 < 0.05 else 'not significant'}")
    print(f"RQ3 (turns vs rating): r={r3:.4f}, p={p3:.4g}, "
          f"{'SIGNIFICANT' if p3 < 0.05 else 'not significant'}")

    player_stats.to_csv("rq1_opening_diversity.csv", index=False)
    df[['avg_rating', 'rating_band', 'turns', 'winner']].to_csv("rq2_rq3_features.csv", index=False)
    print("\nSaved: rq1_opening_diversity.csv, rq2_rq3_features.csv")


if __name__ == "__main__":
    main()