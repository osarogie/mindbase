package journal

import (
	"fmt"
	"strings"
	"time"
)

const NotesDir = "journal"

func DailyPath(t time.Time) string {
	return fmt.Sprintf("%s/%s.md", NotesDir, t.Format("2006-01-02"))
}

func WeeklyPath(t time.Time) string {
	year, week := t.ISOWeek()
	_ = year
	return fmt.Sprintf("%s/%d-W%02d.md", NotesDir, year, week)
}

func DailyTemplate(t time.Time) string {
	title := t.Format("Monday, January 2, 2006")
	return fmt.Sprintf(`# %s

## Focus
- 

## Tasks
- [ ] 

## Notes

`, title)
}

func WeeklyTemplate(t time.Time) string {
	_, week := t.ISOWeek()
	start := startOfISOWeek(t)
	end := start.AddDate(0, 0, 6)
	title := fmt.Sprintf("Week %02d · %s – %s", week, start.Format("Jan 2"), end.Format("Jan 2, 2006"))
	return fmt.Sprintf(`# %s

## Goals
- [ ] 

## Review
- Wins:
- Blockers:

`, title)
}

func ParseDate(input string) (time.Time, error) {
	input = strings.TrimSpace(input)
	if input == "today" {
		return time.Now(), nil
	}
	if input == "tomorrow" {
		return time.Now().AddDate(0, 0, 1), nil
	}
	if input == "yesterday" {
		return time.Now().AddDate(0, 0, -1), nil
	}
	return time.Parse("2006-01-02", input)
}

func NavDates(t time.Time) (prev, next string) {
	return t.AddDate(0, 0, -1).Format("2006-01-02"), t.AddDate(0, 0, 1).Format("2006-01-02")
}

func startOfISOWeek(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).AddDate(0, 0, 1-weekday)
}
