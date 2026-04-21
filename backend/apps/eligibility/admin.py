from django.contrib import admin
from .models import RuleSet, RuleVersion, RuleClause


@admin.register(RuleSet)
class RuleSetAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'scope')
    list_filter = ('organization',)
    search_fields = ('name', 'scope')


class RuleClauseInline(admin.TabularInline):
    model = RuleClause
    extra = 0


@admin.register(RuleVersion)
class RuleVersionAdmin(admin.ModelAdmin):
    list_display = ('ruleset', 'version', 'status', 'effective_from', 'effective_to')
    list_filter = ('status', 'ruleset')
    inlines = [RuleClauseInline]


@admin.register(RuleClause)
class RuleClauseAdmin(admin.ModelAdmin):
    list_display = ('rule_version', 'clause_type', 'category_code')
    list_filter = ('clause_type',)
