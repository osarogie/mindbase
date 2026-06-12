package vaultparse

import "testing"

func TestExtractTagsAndTasks(t *testing.T) {
	content := "# Note\n\n- [ ] Ship feature #project @home >today\n- [x] Done task\n"
	tags := ExtractTags(content)
	if len(tags) != 1 || tags[0] != "project" {
		t.Fatalf("tags: %#v", tags)
	}
	tasks := ExtractTasks("note.md", content)
	if len(tasks) != 2 {
		t.Fatalf("tasks: %d", len(tasks))
	}
	if tasks[0].Done || tasks[0].Schedule == "" {
		t.Fatalf("open task: %#v", tasks[0])
	}
	if !tasks[1].Done {
		t.Fatalf("done task: %#v", tasks[1])
	}
}
