package io.github.gerenciador.gerenciadorDeTarefas.controller;

import io.github.gerenciador.gerenciadorDeTarefas.model.Gerenciador;
import io.github.gerenciador.gerenciadorDeTarefas.repository.GerenciadorRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/tasks")
public class GerenciadorController {

    private final GerenciadorRepository repository;

    public GerenciadorController(GerenciadorRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Gerenciador> list() {
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Gerenciador> get(@PathVariable Long id) {
        Optional<Gerenciador> g = repository.findById(id);
        return g.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    // Accept flexible JSON payloads (used by import tool)
    @PostMapping
    public ResponseEntity<Gerenciador> create(@RequestBody Map<String, Object> payload) {
        Gerenciador entity = mapToEntity(payload, null);
        Gerenciador saved = repository.save(entity);
        return ResponseEntity.created(URI.create("/api/tasks/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Gerenciador> update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return repository.findById(id).map(existing -> {
            Gerenciador updated = mapToEntity(payload, existing);
            repository.save(updated);
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) return ResponseEntity.notFound().build();
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAllCompleted() {
        List<Gerenciador> all = repository.findAll();
        all.stream().filter(Gerenciador::isCompleted).forEach(g -> repository.deleteById(g.getId()));
        return ResponseEntity.noContent().build();
    }

    // Helper: map incoming flexible JSON to entity. If 'existing' is provided, update it; otherwise create new.
    private Gerenciador mapToEntity(Map<String, Object> payload, Gerenciador existing) {
        Gerenciador g = (existing == null) ? new Gerenciador() : existing;

        if (payload.containsKey("title")) g.setTitle(safeString(payload.get("title")));
        if (payload.containsKey("description")) g.setDescription(safeString(payload.get("description")));

        if (payload.containsKey("dueDate")) {
            String due = safeString(payload.get("dueDate"));
            if (due != null && !due.isBlank()) {
                try {
                    g.setDueDate(LocalDate.parse(due));
                } catch (Exception ex) {
                    // ignore invalid format
                }
            } else {
                g.setDueDate(null);
            }
        }

        if (payload.containsKey("priority")) {
            String pr = safeString(payload.get("priority"));
            if (pr != null) g.setPriority(Gerenciador.Priority.fromString(pr.toLowerCase()));
        }

        if (payload.containsKey("tags")) {
            Object tagsObj = payload.get("tags");
            if (tagsObj instanceof List) {
                List<?> raw = (List<?>) tagsObj;
                List<String> tags = new ArrayList<>();
                for (Object o : raw) if (o != null) tags.add(o.toString());
                g.setTags(tags);
            } else if (tagsObj instanceof String) {
                String s = (String) tagsObj;
                String[] parts = s.split("\\s*,\\s*");
                g.setTags(Arrays.asList(parts));
            }
        }

        if (payload.containsKey("completed")) {
            Object c = payload.get("completed");
            if (c instanceof Boolean) g.setCompleted((Boolean) c);
            else g.setCompleted(Boolean.parseBoolean(safeString(c)));
        }

        if (payload.containsKey("orderIndex")) {
            Object oi = payload.get("orderIndex");
            try {
                if (oi instanceof Number) g.setOrderIndex(((Number) oi).intValue());
                else g.setOrderIndex(Integer.parseInt(safeString(oi)));
            } catch (Exception ex) {
                // ignore
            }
        }

        // createdAt: accept flexible formats (ISO instant with Z, offset datetime, or local datetime)
        if (payload.containsKey("createdAt")) {
            Object ca = payload.get("createdAt");
            LocalDateTime parsed = parseToLocalDateTime(ca);
            if (parsed != null) g.setCreatedAt(parsed);
        }

        return g;
    }

    private String safeString(Object o) {
        return (o == null) ? null : o.toString();
    }

    private LocalDateTime parseToLocalDateTime(Object o) {
        if (o == null) return null;
        String s = o.toString();
        if (s.isBlank()) return null;
        // Try multiple parse strategies
        try {
            // Try ISO_INSTANT (e.g., 2025-11-14T16:10:53.123Z)
            Instant inst = Instant.parse(s);
            return LocalDateTime.ofInstant(inst, ZoneId.systemDefault());
        } catch (Exception ignored) {}
        try {
            // Try OffsetDateTime (e.g., 2025-11-14T16:10:53+00:00)
            OffsetDateTime odt = OffsetDateTime.parse(s);
            return odt.toLocalDateTime();
        } catch (Exception ignored) {}
        try {
            // Try LocalDateTime (e.g., 2025-11-14T16:10:53)
            return LocalDateTime.parse(s);
        } catch (Exception ignored) {}
        try {
            // Try date-only
            LocalDate ld = LocalDate.parse(s);
            return ld.atStartOfDay();
        } catch (Exception ignored) {}
        // As last resort, return null
        return null;
    }
}
