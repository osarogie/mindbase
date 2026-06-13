package notion

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const apiBase = "https://api.notion.com/v1"

type Client struct {
	token string
	http  *http.Client
	ver   string
	base  string
}

func NewClient(token string) *Client {
	return &Client{
		token: token,
		http:  &http.Client{Timeout: 60 * time.Second},
		ver:   "2022-06-28",
		base:  apiBase,
	}
}

type SearchResult struct {
	Results []Page `json:"results"`
	HasMore bool   `json:"has_more"`
	Next    string `json:"next_cursor"`
}

type Page struct {
	ID         string     `json:"id"`
	Object     string     `json:"object"`
	URL        string     `json:"url"`
	Created    time.Time  `json:"created_time"`
	Modified   time.Time  `json:"last_edited_time"`
	Properties Properties `json:"properties"`
	Parent     Parent     `json:"parent"`
}

type Parent struct {
	Type       string `json:"type"`
	PageID     string `json:"page_id,omitempty"`
	DatabaseID string `json:"database_id,omitempty"`
}

type Properties map[string]Property

type Property struct {
	Type  string `json:"type"`
	Title []Rich `json:"title,omitempty"`
}

type Rich struct {
	Plain string `json:"plain_text"`
}

type BlockList struct {
	Results []Block `json:"results"`
	HasMore bool    `json:"has_more"`
	Next    string  `json:"next_cursor"`
}

type Block struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`
	HasChild bool            `json:"has_children"`
	Raw      json.RawMessage `json:"-"`
	Data     map[string]any  `json:"-"`
}

// UnmarshalJSON keeps the full block object in Raw so the type-specific payload
// (e.g. paragraph rich_text) survives decoding — the named fields above would
// otherwise drop it, leaving every imported block empty.
func (b *Block) UnmarshalJSON(data []byte) error {
	type alias Block
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*b = Block(a)
	b.Raw = append(json.RawMessage(nil), data...)
	return nil
}

func (c *Client) do(method, path string, body any, out any) error {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = bytes.NewReader(b)
	}
	base := c.base
	if base == "" {
		base = apiBase
	}
	req, err := http.NewRequest(method, base+path, r)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Notion-Version", c.ver)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("notion api %s: %s", resp.Status, string(data))
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

func (c *Client) SearchPages() ([]Page, error) {
	var all []Page
	cursor := ""
	for {
		body := map[string]any{
			"filter":    map[string]string{"value": "page", "property": "object"},
			"page_size": 100,
		}
		if cursor != "" {
			body["start_cursor"] = cursor
		}
		var res SearchResult
		if err := c.do(http.MethodPost, "/search", body, &res); err != nil {
			return nil, err
		}
		all = append(all, res.Results...)
		if !res.HasMore {
			break
		}
		cursor = res.Next
	}
	return all, nil
}

func (c *Client) ListBlocks(pageID string) ([]Block, error) {
	var all []Block
	cursor := ""
	for {
		path := "/blocks/" + pageID + "/children?page_size=100"
		if cursor != "" {
			path += "&start_cursor=" + cursor
		}
		var res BlockList
		if err := c.do(http.MethodGet, path, nil, &res); err != nil {
			return nil, err
		}
		all = append(all, res.Results...)
		if !res.HasMore {
			break
		}
		cursor = res.Next
	}
	return all, nil
}

func PageTitle(p Page) string {
	for _, prop := range p.Properties {
		if prop.Type == "title" && len(prop.Title) > 0 {
			return strings.TrimSpace(prop.Title[0].Plain)
		}
	}
	return "Untitled"
}

func (c *Client) BlocksToMarkdown(pageID string, depth int) (string, error) {
	blocks, err := c.ListBlocks(pageID)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	for _, blk := range blocks {
		line, child, err := c.blockLine(blk, depth)
		if err != nil {
			continue
		}
		b.WriteString(line)
		if child && depth < 4 {
			nested, err := c.BlocksToMarkdown(blk.ID, depth+1)
			if err == nil && nested != "" {
				b.WriteString(nested)
			}
		}
	}
	return b.String(), nil
}

func (c *Client) blockLine(b Block, depth int) (string, bool, error) {
	// Use the raw block JSON (captured in UnmarshalJSON) so the type-specific
	// payload is present; re-marshaling b would only yield the named fields.
	raw := []byte(b.Raw)
	if len(raw) == 0 {
		raw, _ = json.Marshal(b)
	}
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	typ, _ := m["type"].(string)
	payload, _ := m[typ].(map[string]any)
	indent := strings.Repeat("  ", depth)

	text := richText(payload)
	switch typ {
	case "paragraph":
		if text == "" {
			return "\n", false, nil
		}
		return indent + text + "\n\n", false, nil
	case "heading_1":
		return "# " + text + "\n\n", false, nil
	case "heading_2":
		return "## " + text + "\n\n", false, nil
	case "heading_3":
		return "### " + text + "\n\n", false, nil
	case "bulleted_list_item":
		return indent + "- " + text + "\n", b.HasChild, nil
	case "numbered_list_item":
		return indent + "1. " + text + "\n", b.HasChild, nil
	case "to_do":
		checked := false
		if payload != nil {
			if v, ok := payload["checked"].(bool); ok {
				checked = v
			}
		}
		box := "[ ]"
		if checked {
			box = "[x]"
		}
		return indent + "- " + box + " " + text + "\n", b.HasChild, nil
	case "code":
		lang := ""
		if payload != nil {
			if v, ok := payload["language"].(string); ok {
				lang = v
			}
		}
		return "```" + lang + "\n" + text + "\n```\n\n", false, nil
	case "quote":
		return "> " + text + "\n\n", false, nil
	case "divider":
		return "---\n\n", false, nil
	case "child_page":
		title, _ := payload["title"].(string)
		return "\n[[page:" + slug(title) + "]]\n\n", false, nil
	case "child_database":
		title, _ := payload["title"].(string)
		return "\n[[db:" + slug(title) + "]]\n\n", false, nil
	default:
		if text != "" {
			return indent + text + "\n\n", false, nil
		}
		return "", false, nil
	}
}

func richText(payload map[string]any) string {
	if payload == nil {
		return ""
	}
	arr, ok := payload["rich_text"].([]any)
	if !ok {
		return ""
	}
	var parts []string
	for _, item := range arr {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if pt, ok := m["plain_text"].(string); ok {
			parts = append(parts, pt)
		}
	}
	return strings.Join(parts, "")
}

func slug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return "untitled"
	}
	return out
}
